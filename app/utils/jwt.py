import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import HTTPException, status
from loguru import logger

from app.config import settings
from app.models.user import UserRole


def create_access_token(
    user_id: uuid.UUID | str,
    role: str | UserRole,
    expires_delta: timedelta | None = None,
) -> str:
    """Creates a signed short-lived JWT access token for API authentication.

    Claims included:
    - sub: Unique user identifier (UUID string).
    - role: User role string (user, admin, moderator).
    - iat: Issued-at UTC timestamp.
    - exp: Expiration UTC timestamp (default: 15 minutes).
    - type: Fixed claim 'access' to distinguish token intent.
    - jti: Unique token identifier (UUID string).

    Args:
        user_id: Unique identifier for the user.
        role: User role.
        expires_delta: Optional custom lifetime override.

    Returns:
        str: Encoded and signed JWT access token.
    """
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    jti = str(uuid.uuid4())
    role_str = role.value if isinstance(role, UserRole) else str(role)
    user_id_str = str(user_id)

    payload: dict[str, Any] = {
        "sub": user_id_str,
        "role": role_str,
        "type": "access",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    token = jwt.encode(
        payload=payload,
        key=settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    logger.info(
        "Issued JWT access token | user_id={} | jti={} | role={} | exp={}",
        user_id_str,
        jti,
        role_str,
        expire.isoformat(),
    )
    return token


def create_refresh_token(
    user_id: uuid.UUID | str,
    expires_delta: timedelta | None = None,
) -> tuple[str, str, datetime]:
    """Creates a signed long-lived JWT refresh token used exclusively for obtaining new access tokens.

    Claims included:
    - sub: Unique user identifier (UUID string).
    - iat: Issued-at UTC timestamp.
    - exp: Expiration UTC timestamp (default: 7 days).
    - type: Fixed claim 'refresh' to identify token purpose.
    - jti: Unique refresh token identifier (UUID string) used for rotation and revocation.

    Args:
        user_id: Unique identifier for the user.
        expires_delta: Optional custom lifetime override.

    Returns:
        tuple[str, str, datetime]: (encoded_token, jti, expire_datetime)
    """
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    jti = str(uuid.uuid4())
    user_id_str = str(user_id)

    payload: dict[str, Any] = {
        "sub": user_id_str,
        "type": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    token = jwt.encode(
        payload=payload,
        key=settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    logger.info(
        "Issued JWT refresh token | user_id={} | jti={} | exp={}",
        user_id_str,
        jti,
        expire.isoformat(),
    )
    return token, jti, expire


def decode_jwt_token(token: str) -> dict[str, Any]:
    """Decodes and verifies a JWT token signature and expiration.

    Args:
        token: Raw JWT token string.

    Returns:
        dict[str, Any]: Decoded token payload dictionary.

    Raises:
        HTTPException: 401 if token is expired, signature is invalid, or payload is malformed.
    """
    try:
        payload = jwt.decode(
            token,
            key=settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat", "type"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT validation failed: Token signature has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT validation failed: Invalid token - {}", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def verify_access_token(token: str) -> dict[str, Any]:
    """Decodes a JWT and verifies that it is strictly an access token.

    CRITICAL RULE:
    Never accept a refresh token as an access token.

    Args:
        token: Raw JWT token string.

    Returns:
        dict[str, Any]: Verified access token payload.

    Raises:
        HTTPException: 401 if token is invalid, expired, or of wrong type.
    """
    payload = decode_jwt_token(token)
    token_type = payload.get("type")

    if token_type == "refresh":
        logger.warning(
            "Security violation: Attempted to use refresh token as access token | user_id={}",
            payload.get("sub"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cannot be used to authenticate API requests. Please provide a valid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_type != "access":
        logger.warning("Unknown or invalid token type presented for API access: {}", token_type)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for API access.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def verify_refresh_token(token: str) -> dict[str, Any]:
    """Decodes a JWT and verifies that it is strictly a refresh token.

    Args:
        token: Raw JWT token string.

    Returns:
        dict[str, Any]: Verified refresh token payload.

    Raises:
        HTTPException: 401 if token is invalid, expired, or not of type 'refresh'.
    """
    payload = decode_jwt_token(token)
    token_type = payload.get("type")

    if token_type != "refresh":
        logger.warning(
            "Invalid token type on refresh endpoint: expected 'refresh', got '{}'",
            token_type,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. A valid refresh token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload
