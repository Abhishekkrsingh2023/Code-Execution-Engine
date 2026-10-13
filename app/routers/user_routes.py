import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.user_controller import (
    handle_check_username_availability,
    handle_delete_user,
    handle_get_user_by_id,
    handle_get_user_by_username,
    handle_list_users,
    handle_login_user,
    handle_register_user,
    handle_request_otp,
    handle_update_user,
    handle_verify_otp,
)
from app.database import get_db
from app.models.user import UserRole
from app.schemas.user import (
    MessageResponse,
    OTPResponse,
    RequestOTPRequest,
    UserListResponse,
    UserLoginRequest,
    UserLoginResponse,
    UsernameAvailabilityResponse,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
    VerifyOTPRequest,
)

router = APIRouter(
    prefix="/api-v1/users",
    tags=["users"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user profile with a unique username and email. Issues an initial verification OTP. Password is optional.",
    responses={
        201: {"description": "User created successfully with verification OTP issued."},
        409: {"description": "Username or email is already registered."},
        500: {"description": "Internal server error during user creation."},
    },
)
async def register_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """_summary_
    This endpoint registers a new user with the platform.
    The user must provide a unique username and email. Upon creation, email verification
    is initialized to unverified and a 6-digit verification OTP is generated.
    Supports traditional password authentication (when password is provided)
    or passwordless email-OTP authentication (when password is omitted).

    Args:
        payload (UserRegisterRequest): Registration payload with username, email, and optional password.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserResponse: Sanitized user profile without sensitive credentials.

    Raises:
        HTTPException: 409 if the chosen username or email is already in use.
        HTTPException: 500 if database persistence fails.
    """
    return await handle_register_user(payload, db)


@router.post(
    "/login",
    response_model=UserLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="User login with password",
    description="Authenticates a user via registered email/username and password. Enforces verified email address.",
    responses={
        200: {"description": "Login successful."},
        401: {"description": "Invalid credentials or account configured for OTP-only login."},
        403: {
            "description": "Email address is not verified. Please verify your email via OTP before logging in."
        },
    },
)
async def login_user(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> UserLoginResponse:
    """_summary_
    This endpoint authenticates an existing user using their username or email alongside their password.
    Requires the user's email address to be verified.

    Args:
        payload (UserLoginRequest): Login request containing username/email and password.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserLoginResponse: Authentication confirmation, authenticated user profile, and auth method identifier.

    Raises:
        HTTPException: 401 if credentials are invalid or if the account does not have a password configured.
        HTTPException: 403 if the user's email is not verified yet.
    """
    return await handle_login_user(payload, db)


@router.post(
    "/otp/request",
    response_model=OTPResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a 6-digit OTP",
    description="Issues a temporary 6-digit OTP sent to a registered user's email for email verification or passwordless login.",
    responses={
        200: {"description": "OTP generated and dispatched successfully."},
        404: {"description": "No account associated with this email address."},
        500: {"description": "Failed to generate OTP."},
    },
)
async def request_otp(
    payload: RequestOTPRequest,
    db: AsyncSession = Depends(get_db),
) -> OTPResponse:
    """_summary_
    This endpoint initiates email verification or passwordless login via a 6-digit OTP.
    The email must already be registered in the system.

    Args:
        payload (RequestOTPRequest): Target email address for OTP delivery.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        OTPResponse: Confirmation message, email address, and expiration validity in seconds.

    Raises:
        HTTPException: 404 if the email is not registered.
        HTTPException: 500 if OTP generation or database commit fails.
    """
    return await handle_request_otp(payload, db)


@router.post(
    "/otp/verify",
    response_model=UserLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify OTP and login",
    description="Validates a 6-digit OTP for email verification and passwordless login. Marks email verified and invalidates OTP upon success.",
    responses={
        200: {
            "description": "OTP verified successfully. Email marked verified and user logged in."
        },
        400: {"description": "OTP code is incorrect, missing, or expired."},
        404: {"description": "No user account found with the specified email."},
    },
)
async def verify_otp(
    payload: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
) -> UserLoginResponse:
    """_summary_
    This endpoint verifies a 6-digit OTP code submitted by the user.
    Upon successful validation, the user's email is marked as verified, the OTP is invalidated, and login access is granted.

    Args:
        payload (VerifyOTPRequest): Verification payload containing email and 6-digit OTP code.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserLoginResponse: Verification confirmation message, user profile, and auth method ('otp').

    Raises:
        HTTPException: 404 if no user exists for the given email.
        HTTPException: 400 if the OTP does not match or has expired.
    """
    return await handle_verify_otp(payload, db)


@router.get(
    "/",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List users",
    description="Retrieves a paginated list of users with optional role filtering.",
    responses={
        200: {"description": "Paginated list of users retrieved successfully."},
    },
)
async def list_users(
    skip: int = Query(default=0, ge=0, description="Number of records to skip for pagination."),
    limit: int = Query(
        default=20, ge=1, le=100, description="Maximum number of records to return."
    ),
    role: UserRole | None = Query(
        default=None, description="Optional role filter (user, admin, moderator)."
    ),
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    """_summary_
    This endpoint retrieves a paginated list of registered users.
    Supports filtering by UserRole ('user', 'admin', 'moderator').

    Args:
        skip (int): Offset of records to skip (default: 0).
        limit (int): Maximum records per page (default: 20, max: 100).
        role (Optional[UserRole]): Filter criteria by role.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserListResponse: Total count, pagination parameters, and user list.
    """
    return await handle_list_users(skip=skip, limit=limit, role=role, db=db)


@router.get(
    "/username/{username}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user by username",
    description="Fetches public profile information for a user using their unique username handle.",
    responses={
        200: {"description": "User profile found."},
        404: {"description": "User not found."},
    },
)
async def get_user_by_username(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """_summary_
    This endpoint retrieves public profile details for a user identified by their handle.

    Args:
        username (str): The unique username handle.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserResponse: User profile without sensitive credentials.

    Raises:
        HTTPException: 404 if the user cannot be found.
    """
    return await handle_get_user_by_username(username, db)


@router.get(
    "/check-username/{username}",
    response_model=UsernameAvailabilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Check username availability",
    description="Checks whether a given username handle is available for registration, returning boolean availability flags.",
    responses={
        200: {"description": "Username availability status evaluated."},
    },
)
async def check_username_availability(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> UsernameAvailabilityResponse:
    """_summary_
    This endpoint evaluates whether a desired username handle is available for new registration.
    Validates formatting rules and returns true if available, false if already taken or invalid.

    Args:
        username (str): Desired username handle.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UsernameAvailabilityResponse: Availability flags (is_available and available) and the queried username.
    """
    return await handle_check_username_availability(username, db)


@router.get(
    "/check-username",
    response_model=UsernameAvailabilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Check username availability via query parameter",
    description="Checks whether a username handle provided via query parameter is available for registration.",
    responses={
        200: {"description": "Username availability status evaluated."},
    },
)
async def check_username_query(
    username: str = Query(..., description="Desired username handle to evaluate."),
    db: AsyncSession = Depends(get_db),
) -> UsernameAvailabilityResponse:
    """_summary_
    This endpoint evaluates username availability via query string (`?username=...`).

    Args:
        username (str): Desired username handle.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UsernameAvailabilityResponse: Availability flags (is_available and available) and the queried username.
    """
    return await handle_check_username_availability(username, db)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user by UUID",
    description="Fetches public profile information for a user using their unique UUID primary key.",
    responses={
        200: {"description": "User profile found."},
        404: {"description": "User not found."},
    },
)
async def get_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """_summary_
    This endpoint retrieves public profile details for a user identified by their UUID.

    Args:
        user_id (uuid.UUID): The unique primary key of the user.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserResponse: User profile without sensitive credentials.

    Raises:
        HTTPException: 404 if the user cannot be found.
    """
    return await handle_get_user_by_id(user_id, db)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update user profile",
    description="Updates username, email, password, or role for an existing user account.",
    responses={
        200: {"description": "User updated successfully."},
        404: {"description": "User not found."},
        409: {"description": "New username or email collides with another existing user."},
        500: {"description": "Failed to update user profile."},
    },
)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """_summary_
    This endpoint updates profile details, password, or role for a user account.
    Validates uniqueness when changing username or email.

    Args:
        user_id (uuid.UUID): The UUID of the user to update.
        payload (UserUpdateRequest): Fields to update.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserResponse: Updated user profile.

    Raises:
        HTTPException: 404 if user is not found.
        HTTPException: 409 if new username or email is already taken.
        HTTPException: 500 on unexpected database error.
    """
    return await handle_update_user(user_id, payload, db)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete user account",
    description="Deletes a user account and cascades deletion to all associated submissions.",
    responses={
        200: {"description": "User deleted successfully."},
        404: {"description": "User not found."},
    },
)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """_summary_
    This endpoint deletes a user account from the database.
    Due to cascade rules, all submissions belonging to this user are also safely removed.

    Args:
        user_id (uuid.UUID): The UUID of the user to delete.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        MessageResponse: Confirmation message indicating successful deletion.

    Raises:
        HTTPException: 404 if user is not found.
    """
    return await handle_delete_user(user_id, db)
