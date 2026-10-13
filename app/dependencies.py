import uuid

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole, UserStatus


async def get_current_user(
    request: Request,
    authorization: str | None = Header(None, description="Bearer token or user ID"),
    x_user_id: str | None = Header(None, alias="X-User-Id", description="User UUID primary key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency to extract and validate the authenticated user from request headers.

    Accepts:
    - Authorization: Bearer <user_uuid>
    - X-User-Id: <user_uuid>

    Raises:
    - 401 UNAUTHORIZED if missing, malformed, or user not found.
    - 403 FORBIDDEN if user account is deactivated or suspended.
    """
    token: str | None = None

    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        elif len(parts) == 1:
            token = parts[0]

    if not token and x_user_id:
        token = x_user_id.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
