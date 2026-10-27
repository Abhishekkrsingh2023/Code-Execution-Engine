import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserRegisterRequest(BaseModel):
    """_summary_
    Request schema for registering a new user. Supports optional password for passwordless or password-based accounts.
    All public registrations default to standard USER role; roles cannot be self-assigned.

    Attributes:
        name (Optional[str]): Optional full name or display name (max 100 chars).
        username (str): Unique username handle (3-50 chars).
        email (EmailStr): Unique valid email address.
        password (Optional[str]): Optional password string (min 6 characters).
    """

    name: str | None = Field(
        None,
        max_length=100,
        description="Optional full name or display name.",
        examples=["Alice Smith"],
    )
    username: str = Field(

        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Unique user handle (alphanumeric, underscore, dash).",
        examples=["alice_dev"],
    )
    email: EmailStr = Field(
        description="Unique user email address.",
        examples=["alice@example.com"],
    )
    password: str | None = Field(
        None,
        min_length=6,
        max_length=128,
        description="Optional plaintext password for traditional authentication. If omitted, user can authenticate via OTP.",
        examples=["SuperSecret123!"],
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class UserLoginRequest(BaseModel):
    """_summary_
    Request schema for traditional password-based authentication.

    Attributes:
        username_or_email (str): Registered username or email.
        password (str): Account password.
    """

    username_or_email: str = Field(
        min_length=3,
        max_length=255,
        description="Registered username or email address.",
        examples=["alice@example.com"],
    )
    password: str = Field(

        min_length=1,
        max_length=128,
        description="Account password.",
        examples=["SuperSecret123!"],
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class RequestOTPRequest(BaseModel):
    """_summary_
    Request schema to initiate OTP passwordless login / registration.

    Attributes:
        email (EmailStr): Target user email address for OTP delivery.
    """

    email: EmailStr = Field(
        description="User email address for passwordless OTP login.",
        examples=["alice@example.com"],
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class VerifyOTPRequest(BaseModel):
    """_summary_
    Request schema for verifying an issued OTP passcode.

    Attributes:
        email (EmailStr): Target user email address.
        otp (str): 6-digit numeric verification code.
    """

    email: EmailStr = Field(
        description="User email address.",
        examples=["alice@example.com"],
    )
    otp: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric OTP code.",
        examples=["123456"],
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class UserUpdateRequest(BaseModel):
    """_summary_
    Request schema for updating existing user details.

    Attributes:
        name (Optional[str]): Updated full name or display name.
        username (Optional[str]): Updated username.
        password (Optional[str]): Updated plaintext password or new password to add.
        current_password (Optional[str]): Optional current password for verification.
    """

    name: str | None = Field(
        None,
        max_length=100,
        description="Updated full name or display name.",
        examples=["Alice Smith"],
    )
    username: str | None = Field(
        None,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Updated username handle.",
        examples=["alice_updated"],
    )
    password: str | None = Field(
        None,
        min_length=6,
        max_length=128,
        description="Updated account password or new password to add.",
        examples=["NewSecret456!"],
    )
    current_password: str | None = Field(
        None,
        min_length=1,
        max_length=128,
        description="Optional current account password for verification if changing existing password.",
        examples=["OldSecret123!"],
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class UserResponse(BaseModel):
    """_summary_
    Safe public response schema for user profiles (omits password_hash and otp).

    Attributes:
        id (uuid.UUID): Unique UUID identifier.
        name (Optional[str]): User's full name or display name.
        username (str): User handle.
        email (EmailStr): User email address.
        role (UserRole): Role assigned to user.
        status (UserStatus): Account status (active, inactive, suspended).
        is_email_verified (bool): Indicates if the user's email has been verified.
        is_protected (bool): Indicates if account is a protected system account.
        has_password (bool): Indicates if the account has a password set.
        created_at (datetime): Account creation timestamp in UTC.
    """

    id: uuid.UUID = Field( description="Unique UUID identifier of the user.")
    name: str | None = Field(default=None, description="User's full name or display name.")
    username: str = Field( description="User handle.")
    email: EmailStr = Field( description="User email address.")
    role: UserRole = Field( description="Role assigned to user.")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="Account status.")
    is_email_verified: bool = Field(
        default=False, description="Indicates whether the user's email has been verified."
    )
    is_protected: bool = Field(
        default=False, description="Indicates whether the account is a protected system account."
    )
    has_password: bool = Field( description="Indicates whether the account has a password set.")
    total_score: float = Field(
        default=0.0, description="Total score accumulated on the leaderboard."
    )
    problems_solved: int = Field(
        default=0, description="Total distinct problems successfully solved."
    )
    created_at: datetime = Field( description="Account creation timestamp in UTC.")

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )


class UserLoginResponse(BaseModel):
    """_summary_
    Response schema returned after successful authentication (via password or OTP).
    Credentials/tokens are securely delivered via HTTP-only cookies.

    Attributes:
        message (str): Informational status message.
        user (UserResponse): Profile details of the authenticated user.
        auth_method (str): Authentication method utilized ('password' or 'otp').
    """

    message: str = Field( description="Status message.")
    user: UserResponse = Field( description="Profile details of the authenticated user.")
    auth_method: str = Field(
         description="Authentication method utilized ('password' or 'otp')."
    )


class RefreshTokenRequest(BaseModel):
    """_summary_
    Request schema for refreshing JWT tokens when not using HTTP-only cookie transport.

    Attributes:
        refresh_token (Optional[str]): JWT refresh token string (optional if sent via cookie).
    """

    refresh_token: str | None = Field(
        None,
        description="Refresh token string (optional if provided via HTTP-only cookie).",
    )

    model_config = ConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
    )


class TokenRefreshResponse(BaseModel):
    """_summary_
    Response schema returned after successful refresh-token rotation.
    Rotated tokens are set securely via HTTP-only cookies.

    Attributes:
        message (str): Status message.
    """

    message: str = Field("Tokens refreshed successfully.", description="Status message.")


class OTPResponse(BaseModel):
    """_summary_
    Response schema returned when an OTP is requested.

    Attributes:
        message (str): Delivery status message.
        email (EmailStr): Target email address.
        expires_in_seconds (int): Expiry duration in seconds.
    """

    message: str = Field( description="Delivery status confirmation.")
    email: EmailStr = Field( description="Target email address.")
    expires_in_seconds: int = Field( description="Validity period in seconds.")


class UserListResponse(BaseModel):
    """_summary_
    Response schema for paginated user list queries.

    Attributes:
        total (int): Total number of users matching criteria.
        skip (int): Number of skipped records (offset).
        limit (int): Maximum records returned per page.
        users (List[UserResponse]): User profiles list.
    """

    total: int = Field( description="Total user records count.")
    skip: int = Field( description="Pagination offset.")
    limit: int = Field( description="Pagination limit.")
    users: list[UserResponse] = Field( description="List of user profiles.")


class MessageResponse(BaseModel):
    """_summary_
    Generic operation message response.

    Attributes:
        message (str): Status or confirmation message.
    """

    message: str = Field( description="Confirmation message.")


class UsernameAvailabilityResponse(BaseModel):
    """_summary_
    Response schema for username availability check.

    Attributes:
        username (str): Target username handle queried.
        is_available (bool): True if username is available for registration, False if taken.
        available (bool): Convenience alias for is_available.
    """

    username: str = Field( description="Target username handle queried.")
    is_available: bool = Field(

        description="True if the username is available for registration, False if already taken.",
    )
    available: bool = Field( description="Convenience alias reflecting availability.")
