import re
import secrets
from datetime import UTC, datetime

from fastapi import HTTPException, Request, Response, status
from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    MessageResponse,
    OTPResponse,
    RefreshTokenRequest,
    RequestOTPRequest,
    TokenRefreshResponse,
    UserLoginRequest,
    UserLoginResponse,
    UsernameAvailabilityResponse,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
    VerifyOTPRequest,
)
from app.utils.cookies import clear_auth_cookies, set_auth_cookies
from app.utils.jwt import create_access_token, create_refresh_token, decode_jwt_token
from app.utils.security import (
    generate_otp,
    get_otp_expiry,
    hash_password,
    verify_password,
)
from app.utils.token_service import (
    revoke_refresh_token,
    rotate_refresh_token,
    store_refresh_token,
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
        name=payload.name,
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
        logger.info(
            "[MOCK EMAIL] Verification OTP for new user {} is: {} (valid for 10 minutes)",
            new_user.email,
            otp_code,
        )
        return UserResponse.model_validate(new_user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to register user: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user due to an internal error.",
        ) from exc


async def handle_login_user(
    payload: UserLoginRequest,
    db: AsyncSession,
    response: Response | None = None,
) -> UserLoginResponse:
    """_summary_
    Authenticates a user using traditional username/email and password credentials.
    Enforces email verification requirement and issues short-lived JWT access token
    and long-lived JWT refresh token, attaching both as HTTP-only cookies.

    Args:
        payload (UserLoginRequest): Login credentials (username/email and password).
        db (AsyncSession): Active database session.
        response (Optional[Response]): FastAPI response object to attach cookies.

    Returns:
        UserLoginResponse: Successful login message, user profile, and auth method.

    Raises:
        HTTPException: 401 if credentials are invalid or password is not set on the account.
        HTTPException: 403 if user's email has not been verified yet or account is not active.
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

    if user.status != UserStatus.ACTIVE:
        logger.warning("Login rejected for non-active user: {}", user.username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.value}. Please contact support.",
        )

    # Issue JWT tokens
    access_token = create_access_token(user_id=user.id, role=user.role)
    refresh_token, jti, _ = create_refresh_token(user_id=user.id)

    # Register active refresh token in Redis
    await store_refresh_token(user_id=user.id, jti=jti)

    # Set HTTP-only cookies if response object is provided
    if response is not None:
        set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)

    logger.info(
        "User '{}' (ID: {}) logged in via password. Access token and refresh token (jti={}) issued.",
        user.username,
        user.id,
        jti,
    )
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
        logger.info(
            "[MOCK EMAIL] OTP for {} is: {} (valid for 10 minutes)", payload.email, otp_code
        )

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
        ) from exc


async def handle_verify_otp(
    payload: VerifyOTPRequest,
    db: AsyncSession,
    response: Response | None = None,
) -> UserLoginResponse:
    """_summary_
    Verifies the provided 6-digit OTP against the user's stored passcode and expiry time.
    Marks the user's email as verified and invalidates the OTP upon success.
    Issues short-lived JWT access token and long-lived JWT refresh token, attaching both as cookies.

    Args:
        payload (VerifyOTPRequest): Email address and 6-digit OTP.
        db (AsyncSession): Active database session.
        response (Optional[Response]): FastAPI response object to attach cookies.

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
    now = datetime.now(UTC)
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

    # Issue JWT tokens
    access_token = create_access_token(user_id=user.id, role=user.role)
    refresh_token, jti, _ = create_refresh_token(user_id=user.id)

    # Register active refresh token in Redis
    await store_refresh_token(user_id=user.id, jti=jti)

    # Set HTTP-only cookies if response object is provided
    if response is not None:
        set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)

    logger.info(
        "User '{}' (ID: {}) verified OTP. Access token and refresh token (jti={}) issued.",
        user.email,
        user.id,
        jti,
    )
    return UserLoginResponse(
        message="OTP verified successfully. Email verified and login granted.",
        user=UserResponse.model_validate(user),
        auth_method="otp",
    )


async def handle_refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession,
    payload: RefreshTokenRequest | None = None,
) -> TokenRefreshResponse:
    """_summary_
    Validates a JWT refresh token, executes token rotation, invalidates the previous token,
    and returns a newly issued access token and rotated refresh token with updated cookies.

    Args:
        request (Request): Incoming FastAPI request to read cookies or headers.
        response (Response): FastAPI response to attach new rotated cookies.
        db (AsyncSession): Active database session.
        payload (Optional[RefreshTokenRequest]): Optional body payload for non-cookie clients.

    Returns:
        TokenRefreshResponse: Confirmation message of successful token rotation.

    Raises:
        HTTPException: 401 if refresh token is missing, expired, revoked, or reused.
        HTTPException: 403 if user account is deactivated or suspended.
    """
    token_str: str | None = None

    # 1. Cookie transport (preferred)
    cookie_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if cookie_token:
        token_str = cookie_token.strip()

    # 2. Payload transport (fallback for programmatic clients)
    if not token_str and payload and payload.refresh_token:
        token_str = payload.refresh_token.strip()

    # 3. Header transport fallback
    if not token_str:
        auth_header = request.headers.get("authorization")
        if auth_header:
            parts = auth_header.strip().split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token_str = parts[1]
            elif len(parts) == 1:
                token_str = parts[0]

    if not token_str:
        logger.warning(
            "Token refresh rejected: No refresh token provided in cookies, body, or headers."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is required in cookie or request body.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    new_access_token, new_refresh_token, user = await rotate_refresh_token(
        raw_refresh_token=token_str,
        db=db,
    )

    set_auth_cookies(response, access_token=new_access_token, refresh_token=new_refresh_token)

    logger.info("Successfully refreshed tokens for user '{}' (ID: {})", user.username, user.id)
    return TokenRefreshResponse(
        message="Tokens refreshed successfully.",
    )


async def handle_logout_user(
    request: Request,
    response: Response,
) -> MessageResponse:
    """_summary_
    Handles user logout by revoking the active refresh token in Redis and clearing authentication cookies.

    Args:
        request (Request): Incoming HTTP request to locate refresh token.
        response (Response): HTTP response to clear cookies.

    Returns:
        MessageResponse: Confirmation message of successful logout.
    """
    token_str: str | None = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not token_str:
        auth_header = request.headers.get("authorization")
        if auth_header:
            parts = auth_header.strip().split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token_str = parts[1]
            elif len(parts) == 1:
                token_str = parts[0]

    if token_str and token_str.count(".") == 2:
        try:
            payload = decode_jwt_token(token_str)
            user_id = payload.get("sub")
            jti = payload.get("jti")
            if user_id and jti:
                await revoke_refresh_token(user_id=user_id, jti=jti, reason="logout")
                logger.info("Revoked refresh token jti={} on logout for user_id={}", jti, user_id)
        except Exception as exc:
            logger.debug("Non-fatal: Could not decode token on logout: {}", exc)

    clear_auth_cookies(response)
    logger.info("User logged out successfully and auth cookies cleared.")
    return MessageResponse(message="Successfully logged out.")


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


async def handle_update_current_user(
    current_user: User,
    payload: UserUpdateRequest,
    db: AsyncSession,
) -> UserResponse:
    """_summary_
    Updates the authenticated user's profile details.
    Allows changing name, username, and adding or updating password.

    Args:
        current_user (User): Currently authenticated user model instance.
        payload (UserUpdateRequest): Profile update payload containing fields to modify.
        db (AsyncSession): Active database session.

    Returns:
        UserResponse: Updated sanitized user profile.

    Raises:
        HTTPException: 400 if current password verification fails.
        HTTPException: 409 if username is already taken by another account.
        HTTPException: 500 on unexpected database errors.
    """
    if "name" in payload.model_fields_set:
        current_user.name = payload.name if payload.name else None

    if payload.username is not None and payload.username != current_user.username:
        u_stmt = select(User.id).where(
            func.lower(User.username) == func.lower(payload.username),
            User.id != current_user.id,
        )
        existing_user = await db.execute(u_stmt)
        if existing_user.scalar_one_or_none() is not None:
            logger.warning(
                "Profile update failed for user {}: Username '{}' already taken",
                current_user.id,
                payload.username,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{payload.username}' is already taken.",
            )
        current_user.username = payload.username

    if payload.password is not None:
        if payload.current_password is not None and current_user.has_password:
            if not verify_password(payload.current_password, current_user.password_hash or ""):
                logger.warning(
                    "Profile password update failed for user {}: Current password mismatch",
                    current_user.id,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password does not match.",
                )
        current_user.password_hash = hash_password(payload.password)
        logger.info(
            "Updated password for user '{}' (ID: {})",
            current_user.username,
            current_user.id,
        )

    try:
        await db.commit()
        await db.refresh(current_user)
        logger.info(
            "Successfully updated profile for user '{}' (ID: {})",
            current_user.username,
            current_user.id,
        )
        return UserResponse.model_validate(current_user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update profile for user {}: {}", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile due to an internal error.",
        ) from exc
