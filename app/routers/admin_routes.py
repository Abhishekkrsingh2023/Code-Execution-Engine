import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.admin_controller import (
    handle_admin_delete_user,
    handle_admin_update_user,
    handle_get_activity_stats,
    handle_get_admin_user_detail,
    handle_get_audit_log,
    handle_get_dashboard_stats,
    handle_get_problem_stats,
    handle_get_submission_stats,
    handle_get_user_stats,
    handle_list_admin_users,
    handle_list_audit_logs,
    handle_update_user_role,
    handle_update_user_status,
)
from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminUpdateUserRequest,
    AdminUpdateUserRoleRequest,
    AdminUpdateUserStatusRequest,
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AuditLogListResponse,
    AuditLogResponse,
    DashboardStatsResponse,
    ProblemStatsResponse,
    SubmissionStatsResponse,
    SystemActivityStatsResponse,
    UserStatsResponse,
)
from app.schemas.user import MessageResponse

router = APIRouter(
    prefix="/api-v1/admin",
    tags=["admin"],
    # NOTE: require_admin is intentionally NOT added here as a router-level dependency.
    # Every handler that needs admin access already declares:
    #   current_admin: User = Depends(require_admin)
    # Adding it both here and per-handler runs the dependency (and the DB query) twice per request.
)


# ─────────────────────────────────────────────────────────────────────────────
# User Management Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all users with filtering and metrics",
)
async def list_admin_users(
    skip: int = Query(default=0, ge=0, description="Offset."),
    limit: int = Query(default=20, ge=1, le=100, description="Page limit."),
    role: UserRole | None = Query(default=None, description="Filter by user role."),
    user_status: UserStatus | None = Query(
        default=None, alias="status", description="Filter by account status."
    ),
    search: str | None = Query(default=None, description="Search term for username or email."),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AdminUserListResponse:
    """Retrieves paginated user listing with submission and problem metrics."""
    return await handle_list_admin_users(
        skip=skip,
        limit=limit,
        role=role,
        user_status=user_status,
        search=search,
        db=db,
    )


@router.get(
    "/users/{user_id}",
    response_model=AdminUserDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="View detailed user profile and activity",
)
async def get_admin_user_detail(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AdminUserDetailResponse:
    """Retrieves full profile of a user with recent submissions and audit history."""
    return await handle_get_admin_user_detail(user_id=user_id, db=db)


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Change user role (promote/demote)",
)
async def update_user_role(
    user_id: uuid.UUID,
    payload: AdminUpdateUserRoleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AdminUserResponse:
    """Promotes or demotes user role, preventing self-lockout and modifying protected accounts."""
    return await handle_update_user_role(
        admin_user=current_admin,
        user_id=user_id,
        payload=payload,
        request=request,
        db=db,
    )


@router.patch(
    "/users/{user_id}/status",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update account status (activate/deactivate/suspend)",
)
async def update_user_status(
    user_id: uuid.UUID,
    payload: AdminUpdateUserStatusRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AdminUserResponse:
    """Updates account status, preventing self-deactivation and modifying protected accounts."""
    return await handle_update_user_status(
        admin_user=current_admin,
        user_id=user_id,
        payload=payload,
        request=request,
        db=db,
    )


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update user details",
)
async def admin_update_user(
    user_id: uuid.UUID,
    payload: AdminUpdateUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AdminUserResponse:
    """Updates user attributes with collision and self-lockout checks."""
    return await handle_admin_update_user(
        admin_user=current_admin,
        user_id=user_id,
        payload=payload,
        request=request,
        db=db,
    )


@router.delete(
    "/users/{user_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete user account",
)
async def admin_delete_user(
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> MessageResponse:
    """Safely deletes user account, preventing self-delete or deleting protected accounts."""
    return await handle_admin_delete_user(
        admin_user=current_admin,
        user_id=user_id,
        request=request,
        db=db,
    )


# ─────────────────────────────────────────────────────────────────────────────
# System-Wide Statistics and Dashboard Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive system statistics dashboard",
)
async def get_dashboard_stats(
    days: int = Query(default=30, ge=1, le=365, description="Time window for trends in days."),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> DashboardStatsResponse:
    """Consolidated system statistics across users, problems, submissions, and activity."""
    return await handle_get_dashboard_stats(days=days, db=db)


# NOTE: /stats/dashboard alias removed (MED-2). Use GET /stats directly.
# It was identical to /stats and caused double maintenance and OpenAPI schema confusion.


@router.get(
    "/stats/users",
    response_model=UserStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed user metrics and trends",
)
async def get_user_stats(
    days: int = Query(default=30, ge=1, le=365, description="Trend window in days."),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserStatsResponse:
    """Calculates user statistics grouped by role, status, and registration trends."""
    return await handle_get_user_stats(days=days, db=db)


@router.get(
    "/stats/problems",
    response_model=ProblemStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get problem metrics grouped by difficulty, category, topic, status",
)
async def get_problem_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> ProblemStatsResponse:
    """Calculates problem metrics, author counts, and recent changes."""
    return await handle_get_problem_stats(db=db)


@router.get(
    "/stats/submissions",
    response_model=SubmissionStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get submission execution statistics and success rates",
)
async def get_submission_stats(
    days: int = Query(default=30, ge=1, le=365, description="Trend window in days."),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> SubmissionStatsResponse:
    """Calculates submission metrics, error breakdowns, and success rate percentage."""
    return await handle_get_submission_stats(days=days, db=db)


@router.get(
    "/stats/activity",
    response_model=SystemActivityStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get recent administrative and moderator activity",
)
async def get_activity_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> SystemActivityStatsResponse:
    """Retrieves recent admin actions, moderator activity, and creation trends."""
    return await handle_get_activity_stats(db=db)


# ─────────────────────────────────────────────────────────────────────────────
# Audit Log Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    status_code=status.HTTP_200_OK,
    summary="List and filter audit log records",
)
async def list_audit_logs(
    skip: int = Query(default=0, ge=0, description="Offset."),
    limit: int = Query(default=20, ge=1, le=100, description="Page limit."),
    action: str | None = Query(default=None, description="Action filter."),
    actor_id: uuid.UUID | None = Query(default=None, description="Actor user ID filter."),
    actor_role: str | None = Query(default=None, description="Actor role filter."),
    target_type: str | None = Query(default=None, description="Target resource type filter."),
    log_status: str | None = Query(
        default=None, alias="status", description="Outcome status filter (success, failure, error)."
    ),
    start_date: datetime | None = Query(default=None, description="Earliest timestamp filter."),
    end_date: datetime | None = Query(default=None, description="Latest timestamp filter."),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AuditLogListResponse:
    """Retrieves paginated audit log entries with granular filtering."""
    return await handle_list_audit_logs(
        skip=skip,
        limit=limit,
        action=action,
        actor_id=actor_id,
        actor_role=actor_role,
        target_type=target_type,
        log_status=log_status,
        start_date=start_date,
        end_date=end_date,
        db=db,
    )


@router.get(
    "/audit-logs/{log_id}",
    response_model=AuditLogResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single audit log entry by UUID",
)
async def get_audit_log(
    log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> AuditLogResponse:
    """Retrieves a single audit log entry by UUID."""
    return await handle_get_audit_log(log_id=log_id, db=db)
