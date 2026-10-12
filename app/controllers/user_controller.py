import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.schemas.user import (
    MessageResponse,
    OTPResponse,
    RequestOTPRequest,
    UserListResponse,
    UserLoginRequest,
    UserLoginResponse,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
    UsernameAvailabilityResponse,
    VerifyOTPRequest,
)
from app.utils.security import (
    generate_otp,
    get_otp_expiry,
    hash_password,
    verify_password,
)


async def handle_register_user(
    payload: UserRegisterRequest,
    db: AsyncSession,
) -> UserResponse:
    """_summary_
    Registers a new user account with uniqueness validation for email and username.
    Initializes email verification status to unverified and issues an initial verification OTP.

    Args:
        payload (UserRegisterRequest): Registration payload containing username, email, and optional password.
        db (AsyncSession): Active database session.

    Returns:
        UserResponse: Created user profile.

    Raises:
        HTTPException: 409 if email or username is already registered.
        HTTPException: 500 on unexpected persistence errors.
    """
    # Check if email is already taken
    email_stmt = select(User.id).where(User.email == payload.email)
    existing_email = await db.execute(email_stmt)
    if existing_email.scalar_one_or_none() is not None:
        logger.warning("Registration failed: Email '{}' already exists", payload.email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    # Check if username is already taken
    username_stmt = select(User.id).where(User.username == payload.username)
    existing_username = await db.execute(username_stmt)
    if existing_username.scalar_one_or_none() is not None:
        logger.warning("Registration failed: Username '{}' already taken", payload.username)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken.",
        )

    password_hash = hash_password(payload.password) if payload.password else None
    otp_code = generate_otp(6)
    expiry = get_otp_expiry(minutes=10)

    new_user = User(
        username=payload.username,
        email=payload.email,
        password_hash=password_hash,
        otp=otp_code,
        otp_expires_at=expiry,
        role=UserRole.USER,
        is_email_verified=False,
    )

    try:
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        logger.info("Successfully registered user '{}' (ID: {})", new_user.username, new_user.id)
        logger.info("[MOCK EMAIL] Verification OTP for new user {} is: {} (valid for 10 minutes)", new_user.email, otp_code)
        return UserResponse.model_validate(new_user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to register user: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user due to an internal error.",
        )


async def handle_login_user(
    payload: UserLoginRequest,
    db: AsyncSession,
) -> UserLoginResponse:
    """_summary_
    Authenticates a user using traditional username/email and password credentials.
    Enforces email verification requirement.

    Args:
        payload (UserLoginRequest): Login credentials (username/email and password).
        db (AsyncSession): Active database session.

    Returns:
        UserLoginResponse: Successful login message, user profile, and authentication method.

    Raises:
        HTTPException: 401 if credentials are invalid or password is not set on the account.
        HTTPException: 403 if user's email has not been verified yet.
    """
    stmt = select(User).where(
        or_(
            User.email == payload.username_or_email,
            User.username == payload.username_or_email,
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        logger.warning("Login failed for identifier: {}", payload.username_or_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or account configured for OTP login only.",
        )

    if not verify_password(payload.password, user.password_hash):
        logger.warning("Invalid password attempt for user: {}", user.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_email_verified:
        logger.warning("Login rejected for unverified user: {}", user.username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified. Please verify your email via OTP before logging in.",
        )

    logger.info("User '{}' authenticated successfully via password", user.username)
    return UserLoginResponse(
        message="Login successful.",
        user=UserResponse.model_validate(user),
        auth_method="password",
    )


async def handle_request_otp(
    payload: RequestOTPRequest,
    db: AsyncSession,
) -> OTPResponse:
    """_summary_
    Issues a cryptographically secure 6-digit OTP for email verification / passwordless login.
    Requires an existing registered user account.

    Args:
        payload (RequestOTPRequest): Email destination for the OTP.
        db (AsyncSession): Active database session.

    Returns:
        OTPResponse: Confirmation with destination email and validity duration.

    Raises:
        HTTPException: 404 if email is not registered.
        HTTPException: 500 on database error.
    """
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("OTP requested for unregistered email: {}", payload.email)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account associated with this email address. Please register first.",
        )

    otp_code = generate_otp(6)
    expiry = get_otp_expiry(minutes=10)

    try:
        user.otp = otp_code
        user.otp_expires_at = expiry
        logger.info("Updated OTP for existing user '{}'", user.email)

        await db.commit()
        # In production, dispatch email via background worker/SMTP here.
        # For development / judge engine API, we log the OTP safely.
        logger.info("[MOCK EMAIL] OTP for {} is: {} (valid for 10 minutes)", payload.email, otp_code)

        return OTPResponse(
            message="OTP generated and sent to email successfully.",
            email=payload.email,
            expires_in_seconds=600,
        )
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to process OTP request for {}: {}", payload.email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate OTP.",
        )


async def handle_verify_otp(
    payload: VerifyOTPRequest,
    db: AsyncSession,
) -> UserLoginResponse:
    """_summary_
    Verifies the provided 6-digit OTP against the user's stored passcode and expiry time.
    Marks the user's email as verified and invalidates the OTP upon success.

    Args:
        payload (VerifyOTPRequest): Email address and 6-digit OTP.
        db (AsyncSession): Active database session.

    Returns:
        UserLoginResponse: Successful login message, user profile, and authentication method.

    Raises:
        HTTPException: 404 if user is not found.
        HTTPException: 400 if OTP is missing, incorrect, or expired.
    """
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("OTP verification attempted for non-existent email: {}", payload.email)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account associated with this email address.",
        )

    if not user.otp:
        logger.warning("No active OTP on record for user: {}", user.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending OTP request found. Please request a new OTP code.",
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    if user.otp_expires_at and user.otp_expires_at < now:
        user.otp = None
        user.otp_expires_at = None
        await db.commit()
        logger.warning("Expired OTP used for user: {}", user.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new code.",
        )

    # Constant-time comparison
    if not secrets.compare_digest(user.otp, payload.otp):
        logger.warning("Invalid OTP supplied for user: {}", user.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code.",
        )

    # Valid OTP: Mark email verified and consume OTP
    user.otp = None
    user.otp_expires_at = None
    user.is_email_verified = True
    await db.commit()
    await db.refresh(user)

    logger.info("User '{}' successfully verified and logged in via OTP", user.email)
    return UserLoginResponse(
        message="OTP verified successfully. Email verified and login granted.",
        user=UserResponse.model_validate(user),
        auth_method="otp",
    )


async def handle_get_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> UserResponse:
    """_summary_
    Retrieves public profile details for a user by their UUID primary key.

    Args:
        user_id (uuid.UUID): Target user UUID.
        db (AsyncSession): Active database session.

    Returns:
        UserResponse: User profile details.

    Raises:
        HTTPException: 404 if user is not found.
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    return UserResponse.model_validate(user)


async def handle_get_user_by_username(
    username: str,
    db: AsyncSession,
) -> UserResponse:
    """_summary_
    Retrieves public profile details for a user by their unique handle.

    Args:
        username (str): Target user handle.
        db (AsyncSession): Active database session.

    Returns:
        UserResponse: User profile details.

    Raises:
        HTTPException: 404 if user is not found.
    """
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with username '{username}' not found.",
        )

    return UserResponse.model_validate(user)


async def handle_check_username_availability(
    username: str,
    db: AsyncSession,
) -> UsernameAvailabilityResponse:
    """_summary_
    Checks whether a given username handle is available for new registration.
    Validates format constraints and tests case-insensitive uniqueness against the database.

    Args:
        username (str): Target handle to evaluate.
        db (AsyncSession): Active database session.

    Returns:
        UsernameAvailabilityResponse: Availability flags and the evaluated username.
    """
    clean_username = username.strip()

    # Format check: 3-50 chars and alphanumeric/dash/underscore
    if not (3 <= len(clean_username) <= 50) or not re.match(r"^[a-zA-Z0-9_-]+$", clean_username):
        return UsernameAvailabilityResponse(
            username=clean_username,
            is_available=False,
            available=False,
        )

    # Check case-insensitive uniqueness in the database
    stmt = select(User.id).where(func.lower(User.username) == func.lower(clean_username))
    result = await db.execute(stmt)
    is_taken = result.scalar_one_or_none() is not None

    return UsernameAvailabilityResponse(
        username=clean_username,
        is_available=not is_taken,
        available=not is_taken,
    )


async def handle_list_users(
    skip: int,
    limit: int,
    role: Optional[UserRole],
    db: AsyncSession,
) -> UserListResponse:
    """_summary_
    Retrieves a paginated list of users with optional role filtering.

    Args:
        skip (int): Number of records to skip (offset).
        limit (int): Maximum records to return.
        role (Optional[UserRole]): Filter by UserRole if specified.
        db (AsyncSession): Active database session.

    Returns:
        UserListResponse: Total count, pagination parameters, and user list.
    """
    count_stmt = select(func.count(User.id))
    query_stmt = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)

    if role is not None:
        count_stmt = count_stmt.where(User.role == role)
        query_stmt = query_stmt.where(User.role == role)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    users_result = await db.execute(query_stmt)
    users = users_result.scalars().all()

    return UserListResponse(
        total=total,
        skip=skip,
        limit=limit,
        users=[UserResponse.model_validate(u) for u in users],
    )


async def handle_update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    db: AsyncSession,
) -> UserResponse:
    """_summary_
    Updates profile attributes, role, or password for an existing user.
    Enforces uniqueness constraints on modified username or email.

    Args:
        user_id (uuid.UUID): Target user UUID.
        payload (UserUpdateRequest): Fields to update.
        db (AsyncSession): Active database session.

    Returns:
        UserResponse: Updated user profile.

    Raises:
        HTTPException: 404 if user is not found.
        HTTPException: 409 if requested username or email is already taken by another user.
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    # Check username collision if updating
    if payload.username is not None and payload.username != user.username:
        u_stmt = select(User.id).where(User.username == payload.username, User.id != user_id)
        if (await db.execute(u_stmt)).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{payload.username}' is already taken.",
            )
        user.username = payload.username

    # Check email collision if updating
    if payload.email is not None and payload.email != user.email:
        e_stmt = select(User.id).where(User.email == payload.email, User.id != user_id)
        if (await db.execute(e_stmt)).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{payload.email}' is already registered.",
            )
        user.email = payload.email

    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    if payload.role is not None:
        user.role = payload.role

    if payload.is_email_verified is not None:
        user.is_email_verified = payload.is_email_verified

    try:
        await db.commit()
        await db.refresh(user)
        logger.info("Updated profile for user '{}' (ID: {})", user.username, user.id)
        return UserResponse.model_validate(user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update user {}: {}", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile.",
        )


async def handle_delete_user(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> MessageResponse:
    """_summary_
    Deletes a user account and cascades deletion to all associated records.

    Args:
        user_id (uuid.UUID): Target user UUID.
        db (AsyncSession): Active database session.

    Returns:
        MessageResponse: Success confirmation message.

    Raises:
        HTTPException: 404 if user is not found.
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    username = user.username
    await db.delete(user)
    await db.commit()
    logger.info("Deleted user '{}' (ID: {})", username, user_id)

    return MessageResponse(message=f"User '{username}' with ID '{user_id}' was successfully deleted.")
