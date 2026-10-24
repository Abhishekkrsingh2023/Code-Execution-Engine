import uuid
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select

from app.config import settings
from app.database import SessionDep
from app.models.user import User, UserRole, UserStatus
from app.utils.jwt import verify_access_token
from app.utils.security import extract_bearer_token


async def get_current_user(
    request: Request,
    db: SessionDep,
    authorization: Annotated[str | None, Header(description="Bearer JWT access token")] = None,
) -> User:
    """Dependency to extract and validate the authenticated user from request cookies or headers.

    Extraction Priority:
    1. HTTP-Only Cookie: access_token
    2. Header: Authorization: Bearer <jwt_access_token>

    Token Validation:
    - Decodes and validates JWT signature, expiration, and claims.
    - Strictly enforces token type == 'access'. Never accepts a refresh token.
    - Raw UUID header authentication has been removed (HIGH-5): it bypassed token
      expiry, revocation, and rotation entirely.

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
        token = extract_bearer_token(authorization)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate token — JWT only; raw-UUID header auth removed (security: no expiry/revocation)
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


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def require_admin(
    current_user: CurrentUserDep,
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


AdminUserDep = Annotated[User, Depends(require_admin)]


async def require_moderator_or_admin(
    current_user: CurrentUserDep,
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


ModeratorUserDep = Annotated[User, Depends(require_moderator_or_admin)]


async def get_current_user_optional(
    request: Request,
    db: SessionDep,
    authorization: Annotated[str | None, Header(description="Bearer JWT access token")] = None,
) -> User | None:
    """Dependency that extracts current user if authenticated, or None if anonymous/unauthenticated."""
    try:
        return await get_current_user(
            request=request,
            authorization=authorization,
            db=db,
        )
    except HTTPException:
        return None


CurrentUserOptionalDep = Annotated[User | None, Depends(get_current_user_optional)]
