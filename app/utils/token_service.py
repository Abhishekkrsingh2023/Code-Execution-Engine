import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from loguru import logger
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User, UserStatus
from app.redis_client import get_async_redis_client
from app.utils.jwt import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)


def _user_tokens_set_key(user_id: str) -> str:
    """Returns the Redis key tracking all active refresh token JTIs for a user."""
    return f"user_refresh_tokens:{user_id}"


def _active_token_key(user_id: str, jti: str) -> str:
    """Returns the Redis key for a specific active refresh token."""
    return f"{settings.REDIS_REFRESH_TOKEN_PREFIX}{user_id}:{jti}"


def _revoked_token_key(jti: str) -> str:
    """Returns the Redis key for a revoked/rotated refresh token."""
    return f"{settings.REDIS_REVOKED_TOKEN_PREFIX}{jti}"


async def store_refresh_token(
    user_id: uuid.UUID | str,
    jti: str,
    expires_in_seconds: int = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    redis: Redis | None = None,
) -> None:
    """Stores an active refresh token JTI in Redis with automatic TTL expiration.

    Args:
        user_id: User identifier.
        jti: Unique refresh token identifier.
        expires_in_seconds: Time to live in seconds (default 7 days).
        redis: Optional async Redis client instance.
    """
    user_id_str = str(user_id)
    r = redis or get_async_redis_client()
    active_key = _active_token_key(user_id_str, jti)
    set_key = _user_tokens_set_key(user_id_str)

    try:
        now_iso = datetime.now(UTC).isoformat()
        await r.set(active_key, now_iso, ex=expires_in_seconds)
        await r.sadd(set_key, jti)
        # Ensure user set expires eventually to prevent stale keys
        await r.expire(set_key, expires_in_seconds + 3600)
        logger.debug(
            "Registered active refresh token in Redis | user_id={} | jti={} | ttl={}s",
            user_id_str,
            jti,
            expires_in_seconds,
        )
    except Exception as exc:
        logger.error(
            "Failed to store refresh token in Redis for user_id={}: {}",
            user_id_str,
            exc,
        )


async def revoke_refresh_token(
    user_id: uuid.UUID | str,
    jti: str,
    remaining_seconds: int = 7 * 86400,
    reason: str = "revoked",
    redis: Redis | None = None,
) -> None:
    """Marks a refresh token JTI as revoked in Redis and removes it from active tokens.

    Args:
        user_id: User identifier.
        jti: Token unique identifier.
        remaining_seconds: Retention time for the revoked marker (to detect replay attacks).
        reason: Reason for revocation ('rotated', 'logout', 'reuse_detected').
        redis: Optional async Redis client instance.
    """
    user_id_str = str(user_id)
    r = redis or get_async_redis_client()
    active_key = _active_token_key(user_id_str, jti)
    revoked_key = _revoked_token_key(jti)
    set_key = _user_tokens_set_key(user_id_str)

    # Ensure revocation tombstone persists at least 24 hours to prevent replay attacks
    ttl = max(remaining_seconds, 86400)

    try:
        await r.set(revoked_key, reason, ex=ttl)
        await r.delete(active_key)
        await r.srem(set_key, jti)
        logger.info(
            "Revoked refresh token in Redis | user_id={} | jti={} | reason={} | tombstone_ttl={}s",
            user_id_str,
            jti,
            reason,
            ttl,
        )
    except Exception as exc:
        logger.error("Failed to revoke refresh token in Redis for jti={}: {}", jti, exc)


async def is_refresh_token_revoked(jti: str, redis: Redis | None = None) -> bool:
    """Checks whether a given refresh token JTI is recorded as revoked.

    Args:
        jti: Unique refresh token identifier.
        redis: Optional async Redis client instance.

    Returns:
        bool: True if token is revoked/spent, False otherwise.
    """
    r = redis or get_async_redis_client()
    try:
        return bool(await r.exists(_revoked_token_key(jti)))
    except Exception as exc:
        logger.error("Error checking token revocation in Redis for jti={}: {}", jti, exc)
        return False


async def is_refresh_token_active(
    user_id: uuid.UUID | str,
    jti: str,
    redis: Redis | None = None,
) -> bool:
    """Checks whether a given refresh token JTI is active for the user.

    Args:
        user_id: User identifier.
        jti: Unique refresh token identifier.
        redis: Optional async Redis client instance.

    Returns:
        bool: True if token is currently active, False otherwise.
    """
    user_id_str = str(user_id)
    r = redis or get_async_redis_client()
    try:
        return bool(await r.exists(_active_token_key(user_id_str, jti)))
    except Exception as exc:
        logger.error("Error checking active token in Redis for jti={}: {}", jti, exc)
        return True  # Graceful fallback if Redis fails momentarily


async def revoke_all_user_refresh_tokens(
    user_id: uuid.UUID | str,
    reason: str = "security_compromise",
    redis: Redis | None = None,
) -> None:
    """Revokes all active refresh tokens for a user.

    Used when token reuse / theft is detected to secure the compromised account.

    Args:
        user_id: User identifier.
        reason: Explanation for bulk revocation.
        redis: Optional async Redis client instance.
    """
    user_id_str = str(user_id)
    r = redis or get_async_redis_client()
    set_key = _user_tokens_set_key(user_id_str)

    try:
        jtis = await r.smembers(set_key)
        for jti in jtis:
            await r.set(_revoked_token_key(jti), reason, ex=7 * 86400)
            await r.delete(_active_token_key(user_id_str, jti))
        await r.delete(set_key)
        logger.warning(
            "Bulk revoked {} refresh token(s) for user_id={} | reason={}",
            len(jtis),
            user_id_str,
            reason,
        )
    except Exception as exc:
        logger.error("Error during bulk revocation for user_id={}: {}", user_id_str, exc)


async def rotate_refresh_token(
    raw_refresh_token: str,
    db: AsyncSession,
    redis: Redis | None = None,
) -> tuple[str, str, User]:
    """Validates an incoming refresh token, executes token rotation, and returns new tokens.

    Enforces Refresh Token Rotation strategy:
    1. Decodes and validates signature, expiry, and token type ('refresh').
    2. Verifies token is not revoked. If already revoked, DETECTS TOKEN REUSE:
       invalidates ALL active tokens for the user and raises 401.
    3. Verifies token is active in Redis.
    4. Invalidates the old refresh token (marks as revoked).
    5. Issues a brand-new access token and rotated refresh token.
    6. Stores the new refresh token in Redis.

    Args:
        raw_refresh_token: The incoming JWT refresh token.
        db: Database session to load and verify user status.
        redis: Optional async Redis client instance.

    Returns:
        tuple[str, str, User]: (new_access_token, new_refresh_token, user)

    Raises:
        HTTPException: 401 if token is expired, revoked, reused, or invalid.
        HTTPException: 403 if user account is deactivated or suspended.
    """
    # 1. Decode and verify token structure and claims
    payload: dict[str, Any] = verify_refresh_token(raw_refresh_token)

    user_id_str = payload.get("sub")
    old_jti = payload.get("jti")
    exp_timestamp = payload.get("exp", 0)

    if not user_id_str or not old_jti:
        logger.warning("Refresh token missing required sub or jti claims: {}", payload)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed refresh token claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        logger.warning("Invalid UUID in refresh token sub claim: {}", user_id_str)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    # 2. Check for Token Reuse / Revocation
    if await is_refresh_token_revoked(old_jti, redis=redis):
        logger.critical(
            "SECURITY ALERT: Refresh token reuse detected! user_id={} | jti={}. "
            "Revoking all active sessions for this account.",
            user_id_str,
            old_jti,
        )
        await revoke_all_user_refresh_tokens(
            user_id_str, reason="token_reuse_detected", redis=redis
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or already used. All active sessions have been terminated for security.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Check if token is currently active
    is_active = await is_refresh_token_active(user_id_str, old_jti, redis=redis)
    if not is_active:
        logger.warning(
            "Refresh token jti={} not found in active tokens for user_id={}",
            old_jti,
            user_id_str,
        )
        await revoke_all_user_refresh_tokens(user_id_str, reason="unrecognized_token", redis=redis)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unrecognized refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Invalidate the old refresh token immediately (Rotation)
    now_ts = int(datetime.now(UTC).timestamp())
    remaining_secs = max(exp_timestamp - now_ts, 86400)
    await revoke_refresh_token(
        user_id=user_id_str,
        jti=old_jti,
        remaining_seconds=remaining_secs,
        reason="rotated",
        redis=redis,
    )

    # 5. Load and validate user from database
    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User {} from refresh token not found in database", user_id_str)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.ACTIVE:
        logger.warning("Refresh token rejected: user {} has status {}", user_id_str, user.status)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.value}. Please contact support.",
        )

    # 6. Issue replacement Access Token and Rotated Refresh Token
    new_access_token = create_access_token(user_id=user.id, role=user.role)
    new_refresh_token, new_jti, _ = create_refresh_token(user_id=user.id)

    # 7. Persist new active refresh token
    await store_refresh_token(
        user_id=user.id,
        jti=new_jti,
        expires_in_seconds=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        redis=redis,
    )

    logger.info(
        "Successfully rotated refresh token | user_id={} | revoked_old_jti={} | issued_new_jti={}",
        user_id_str,
        old_jti,
        new_jti,
    )

    return new_access_token, new_refresh_token, user
