import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus
from app.schemas.problem import ProblemResponse

# ─────────────────────────────────────────────────────────────────────────────
# User Management Schemas
# ─────────────────────────────────────────────────────────────────────────────


class AdminUserResponse(BaseModel):
    """User profile response for administrators with activity metrics."""

    id: uuid.UUID = Field(description="User unique identifier.")
    name: str | None = Field(default=None, description="User's full name.")
    username: str = Field(description="User handle.")
    email: EmailStr = Field(description="User email address.")
    role: UserRole = Field(description="Role (user, moderator, admin).")
    status: UserStatus = Field(description="Account status (active, inactive, suspended).")
    is_email_verified: bool = Field(description="Whether email has been verified.")
    is_protected: bool = Field(description="Whether account is a protected system account.")
    has_password: bool = Field(description="Whether account has a password set.")
    created_at: datetime = Field(description="Registration timestamp.")
    total_score: float = Field(
        default=0.0, description="Total score accumulated on the leaderboard."
    )
    problems_solved: int = Field(default=0, description="Total distinct problems solved.")
    submissions_count: int = Field(default=0, description="Total submissions submitted by user.")
    problems_created_count: int = Field(
        default=0, description="Total problems authored by user (for moderators/admins)."
    )

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )


class AdminUserDetailResponse(AdminUserResponse):
    """Detailed user profile with recent activity."""

    recent_submissions: list[dict[str, Any]] = Field(
        default_factory=list, description="Recent user submissions."
    )
    recent_audit_actions: list[dict[str, Any]] = Field(
        default_factory=list, description="Recent audit actions affecting or triggered by user."
    )


class AdminUserListResponse(BaseModel):
    """Paginated user list for admin management."""

    total: int = Field(description="Total users matching criteria.")
    skip: int = Field(description="Pagination offset.")
    limit: int = Field(description="Pagination limit.")
    users: list[AdminUserResponse] = Field(description="List of user profiles.")


class AdminUpdateUserRoleRequest(BaseModel):
    """Request schema for updating a user's role (promote/demote)."""

    role: UserRole = Field(
        ...,
        description="Target user role (user, moderator, admin).",
        examples=[UserRole.MODERATOR],
    )

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class AdminUpdateUserStatusRequest(BaseModel):
    """Request schema for activating, deactivating, or suspending an account."""

    status: UserStatus = Field(
        ...,
        description="Target account status (active, inactive, suspended).",
        examples=[UserStatus.SUSPENDED],
    )

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class AdminUpdateUserRequest(BaseModel):
    """Comprehensive user update schema for administrators."""

    name: str | None = Field(None, max_length=100, description="Updated full name.")
    username: str | None = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=6, max_length=128)
    role: UserRole | None = None
    status: UserStatus | None = None
    is_email_verified: bool | None = None
    is_protected: bool | None = None

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Audit Log Schemas
# ─────────────────────────────────────────────────────────────────────────────


class AuditLogResponse(BaseModel):
    """Audit log entry response."""

    id: uuid.UUID = Field(description="Audit record ID.")
    actor_id: uuid.UUID | None = Field(None, description="ID of user who performed the action.")
    actor_username: str | None = Field(None, description="Username of actor.")
    actor_role: str | None = Field(None, description="Role of actor at action time.")
    action: str = Field(description="Action identifier.")
    target_type: str | None = Field(
        None, description="Type of target resource (e.g. user, problem)."
    )
    target_id: str | None = Field(None, description="ID of target resource.")
    status: str = Field(description="Execution outcome (success, failure, error).")
    details: dict[str, Any] | None = Field(None, description="Sanitized metadata about the change.")
    error_message: str | None = Field(None, description="Error message if failed.")
    ip_address: str | None = Field(None, description="Client IP address.")
    created_at: datetime = Field(description="Timestamp of action.")

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )


class AuditLogListResponse(BaseModel):
    """Paginated list of audit logs."""

    total: int = Field(description="Total audit records.")
    skip: int = Field(description="Offset.")
    limit: int = Field(description="Limit.")
    logs: list[AuditLogResponse] = Field(description="Audit records.")


# ─────────────────────────────────────────────────────────────────────────────
# Statistics and Dashboard Schemas
# ─────────────────────────────────────────────────────────────────────────────


class TimeSeriesPoint(BaseModel):
    """Single point for time series graphs."""

    date: str = Field(description="Date string (YYYY-MM-DD).")
    count: int = Field(description="Occurrence count.")


class ModeratorProblemCount(BaseModel):
    """Count of problems created by a moderator."""

    moderator_id: str = Field(description="Moderator user ID.")
    username: str = Field(description="Moderator username.")
    count: int = Field(description="Total problems authored.")


class UserStatsResponse(BaseModel):
    """Aggregate statistics for users."""

    total_users: int = Field(description="Total registered users.")
    by_role: dict[str, int] = Field(
        description="Count of users grouped by role (user, moderator, admin)."
    )
    by_status: dict[str, int] = Field(
        description="Count of users grouped by status (active, inactive, suspended)."
    )
    new_registrations_in_period: int = Field(
        description="New registrations within the requested time period."
    )
    registrations_trend: list[TimeSeriesPoint] = Field(
        default_factory=list, description="Daily registrations trend."
    )


class ProblemStatsResponse(BaseModel):
    """Aggregate statistics for programming problems."""

    total_problems: int = Field(description="Total active (non-deleted) problems.")
    total_including_deleted: int = Field(description="Total problems including soft-deleted.")
    by_difficulty: dict[str, int] = Field(
        description="Problems grouped by difficulty (easy, medium, hard)."
    )
    by_category: dict[str, int] = Field(description="Problems grouped by category.")
    by_topic: dict[str, int] = Field(
        description="Problems grouped by topic (array, tree, linkedlist, etc.)."
    )
    by_status: dict[str, int] = Field(
        description="Problems grouped by status (published, unpublished, draft, archived)."
    )
    problems_by_moderator: list[ModeratorProblemCount] = Field(
        default_factory=list, description="Problems created by each moderator."
    )
    recently_created: list[ProblemResponse] = Field(
        default_factory=list, description="Recently created problems."
    )
    recently_updated: list[ProblemResponse] = Field(
        default_factory=list, description="Recently updated problems."
    )
    recently_deleted: list[ProblemResponse] = Field(
        default_factory=list, description="Recently deleted problems."
    )


class SubmissionStatsResponse(BaseModel):
    """Aggregate statistics for code submissions and execution results."""

    total_submissions: int = Field(description="Total submissions in system.")
    accepted: int = Field(description="Count of accepted submissions.")
    rejected: int = Field(description="Count of rejected/failed submissions.")
    compilation_errors: int = Field(description="Count of compilation error submissions.")
    runtime_errors: int = Field(description="Count of runtime error submissions.")
    time_limit_exceeded: int = Field(description="Count of time limit exceeded submissions.")
    memory_limit_exceeded: int = Field(
        description="Count of memory limit exceeded submissions."
    )
    success_rate: float = Field(
        description="Submission success rate percentage (0.0 to 100.0)."
    )
    submissions_trend: list[TimeSeriesPoint] = Field(
        default_factory=list, description="Daily submissions trend."
    )


class SystemActivityStatsResponse(BaseModel):
    """System-wide recent activity and trends."""

    recent_admin_actions: list[AuditLogResponse] = Field(
        default_factory=list, description="Recent actions performed by administrators."
    )
    recent_moderator_activity: list[AuditLogResponse] = Field(
        default_factory=list, description="Recent actions performed by moderators."
    )
    user_creation_trend: list[TimeSeriesPoint] = Field(
        default_factory=list, description="Trend of user creations."
    )
    problem_creation_trend: list[TimeSeriesPoint] = Field(
        default_factory=list, description="Trend of problem creations."
    )


class DashboardStatsResponse(BaseModel):
    """Consolidated dashboard statistics overview."""

    users: UserStatsResponse = Field(description="User metrics.")
    problems: ProblemStatsResponse = Field(description="Problem metrics.")
    submissions: SubmissionStatsResponse = Field(description="Submission metrics.")
    activity: SystemActivityStatsResponse = Field(description="System activity metrics.")
