from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.user_controller import (
    handle_check_username_availability,
    handle_get_user_by_username,
    handle_login_user,
    handle_logout_user,
    handle_refresh_token,
    handle_register_user,
    handle_request_otp,
    handle_update_current_user,
    handle_verify_otp,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models.user import User
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
@limiter.limit("10/minute")
async def register_user(
    request: Request,
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
@limiter.limit("10/minute")
async def login_user(
    request: Request,
    payload: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserLoginResponse:
    """_summary_
    This endpoint authenticates an existing user using their username or email alongside their password.
    Requires the user's email address to be verified. Issues JWT access and refresh tokens, setting HTTP-only cookies.

    Args:
        payload (UserLoginRequest): Login request containing username/email and password.
        response (Response): Response object to attach HTTP-only cookies.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserLoginResponse: Authentication confirmation, authenticated user profile, and auth method identifier.

    Raises:
        HTTPException: 401 if credentials are invalid or if the account does not have a password configured.
        HTTPException: 403 if the user's email is not verified yet.
    """
    return await handle_login_user(payload=payload, db=db, response=response)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get currently authenticated user profile",
    description="Retrieves the authenticated user profile using HTTP-only cookies or Authorization header.",
    responses={
        200: {"description": "Authenticated user profile."},
        401: {"description": "Unauthenticated."},
        403: {"description": "Account suspended or deactivated."},
    },
)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Returns the profile of the authenticated user from cookies or Authorization header."""
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update authenticated user profile",
    description="Updates the authenticated user's profile details such as name, username, email, or sets/updates account password.",
    responses={
        200: {"description": "User profile updated successfully."},
        400: {"description": "Current password does not match or invalid update payload."},
        401: {"description": "Unauthenticated."},
        409: {"description": "Username or email is already in use by another account."},
        500: {"description": "Internal server error during profile update."},
    },
)
async def update_current_user_profile(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """_summary_
    This endpoint allows the currently authenticated user to update their personal details,
    such as their display name, username handle, email address, or add/change their password.

    Args:
        payload (UserUpdateRequest): Fields to update.
        current_user (User): Authenticated user instance from JWT/cookies.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserResponse: Sanitized updated user profile.

    Raises:
        HTTPException: 400 if current password verification fails.
        HTTPException: 409 if username or email is already taken.
        HTTPException: 500 if database persistence fails.
    """
    return await handle_update_current_user(current_user=current_user, payload=payload, db=db)


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
@limiter.limit("5/minute")
async def request_otp(
    request: Request,
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
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserLoginResponse:
    """_summary_
    This endpoint verifies a 6-digit OTP code submitted by the user.
    Upon successful validation, the user's email is marked as verified, the OTP is invalidated,
    login access is granted, and access/refresh tokens are issued with HTTP-only cookies attached.

    Args:
        payload (VerifyOTPRequest): Verification payload containing email and 6-digit OTP code.
        response (Response): Response object to attach HTTP-only cookies.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        UserLoginResponse: Verification confirmation message, user profile, and auth method ('otp').

    Raises:
        HTTPException: 404 if no user exists for the given email.
        HTTPException: 400 if the OTP does not match or has expired.
    """
    return await handle_verify_otp(payload=payload, db=db, response=response)


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh JWT access token",
    description="Rotates the refresh token and issues a new access token, updating HTTP-only cookies. Prevents reuse of revoked tokens.",
    responses={
        200: {"description": "Tokens refreshed and rotated successfully."},
        401: {"description": "Invalid, expired, revoked, or reused refresh token."},
        403: {"description": "Account suspended or deactivated."},
    },
)
async def refresh_token(
    request: Request,
    response: Response,
    payload: RefreshTokenRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> TokenRefreshResponse:
    """_summary_
    This endpoint validates the presented refresh token (from HTTP-only cookie or request body),
    invalidates the old refresh token, detects token reuse, and issues a new pair of access and refresh tokens.

    Args:
        request (Request): Request object to extract refresh token cookie or header.
        response (Response): Response object to attach rotated HTTP-only cookies.
        payload (Optional[RefreshTokenRequest]): Optional body payload for non-cookie clients.
        db (AsyncSession): Database session injected via dependency.

    Returns:
        TokenRefreshResponse: Confirmation status message with rotated tokens set via HTTP-only cookies.

    Raises:
        HTTPException: 401 if refresh token is missing, expired, revoked, or reused.
        HTTPException: 403 if account is suspended or inactive.
    """
    return await handle_refresh_token(
        request=request,
        response=response,
        db=db,
        payload=payload,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Log out user",
    description="Revokes the active refresh token in Redis and clears HTTP-only authentication cookies.",
    responses={
        200: {"description": "User logged out successfully and cookies cleared."},
    },
)
async def logout_user(
    request: Request,
    response: Response,
) -> MessageResponse:
    """_summary_
    This endpoint logs out the current user by revoking their active refresh token in Redis
    and clearing all HTTP-only authentication cookies from the client.

    Args:
        request (Request): Request object containing cookies or headers.
        response (Response): Response object to instruct the browser to delete cookies.

    Returns:
        MessageResponse: Confirmation message of successful logout.
    """
    return await handle_logout_user(request=request, response=response)


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
