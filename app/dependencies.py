import uuid

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.utils.jwt import verify_access_token


async def get_current_user(
    request: Request,
    authorization: str | None = Header(None, description="Bearer token or user ID"),
    x_user_id: str | None = Header(None, alias="X-User-Id", description="User UUID primary key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency to extract and validate the authenticated user from request cookies or headers.

    Extraction Priority:
    1. HTTP-Only Cookie: access_token
    2. Header: Authorization: Bearer <jwt_access_token | user_uuid>
    3. Header: X-User-Id: <user_uuid>

    Token Validation:
    - Decodes and validates JWT signature, expiration, and claims.
    - Strictly enforces token type == 'access'. Never accepts a refresh token.
    - Preserves backwards compatibility for raw UUID identifiers in headers.

    Raises:
    - 401 UNAUTHORIZED if missing, expired, invalid, or user not found.
    - 403 FORBIDDEN if user account is deactivated or suspended.
    """
    token: str | None = None

    # 1. Check HTTP cookie first (Cookie-based authentication)
    cookie_token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
    if cookie_token:
        token = cookie_token.strip()

    # 2. Check Authorization header
    if not token and authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        elif len(parts) == 1:
            token = parts[0]

    # 3. Check X-User-Id fallback header
    if not token and x_user_id:
        token = x_user_id.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_uuid: uuid.UUID
    # Determine if token is a JWT (typically 3 dot-separated base64 segments)
    if token.count(".") == 2:
        payload = verify_access_token(token)
        sub = payload.get("sub")
        try:
            user_uuid = uuid.UUID(sub)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user identifier claim in token.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
    else:
        # Fallback to direct UUID parsing for legacy header authentication
        try:
            user_uuid = uuid.UUID(token)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token format.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None

    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or credentials invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.value}. Please contact support.",
        )

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency that restricts endpoint access strictly to administrators.

    Raises 403 Forbidden for normal users and moderators.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for this resource.",
        )
    return current_user


async def require_moderator_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency that restricts endpoint access to moderators and administrators.

    Raises 403 Forbidden for normal users.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator or Admin access required for this resource.",
        )
    return current_user


async def get_current_user_optional(
    request: Request,
    authorization: str | None = Header(None, description="Bearer token or user ID"),
    x_user_id: str | None = Header(None, alias="X-User-Id", description="User UUID primary key"),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Dependency that extracts current user if authenticated, or None if anonymous/unauthenticated."""
    try:
        return await get_current_user(
            request=request,
            authorization=authorization,
            x_user_id=x_user_id,
            db=db,
        )
    except HTTPException:
        return None
