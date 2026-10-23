import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, Request, status
from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.problem import Problem
from app.models.submission import Submission
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
    ModeratorProblemCount,
    ProblemStatsResponse,
    SubmissionStatsResponse,
    SystemActivityStatsResponse,
    TimeSeriesPoint,
    UserStatsResponse,
)
from app.schemas.problem import ProblemResponse
from app.schemas.user import MessageResponse
from app.utils.audit_logger import log_audit_event, to_str_val
from app.utils.security import hash_password

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────


async def _get_user_or_404(user_id: uuid.UUID, db: AsyncSession) -> User:
    """Retrieves user by UUID or raises HTTP 404."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )
    return user


async def _fetch_daily_trend(
    db: AsyncSession,
    date_column: Any,
    entity_id_column: Any,
    cutoff: datetime,
) -> list[TimeSeriesPoint]:
    """Aggregates entity counts grouped by day since cutoff date."""
    date_col = func.date_trunc("day", date_column)
    trend_stmt = (
        select(date_col.label("day"), func.count(entity_id_column))
        .where(date_column >= cutoff)
        .group_by("day")
        .order_by("day")
    )
    rows = (await db.execute(trend_stmt)).all()
    return [
        TimeSeriesPoint(
            date=row[0].strftime("%Y-%m-%d") if hasattr(row[0], "strftime") else str(row[0]),
            count=row[1],
        )
        for row in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# User Management Handlers
# ─────────────────────────────────────────────────────────────────────────────


async def handle_list_admin_users(
    skip: int,
    limit: int,
    role: UserRole | None,
    user_status: UserStatus | None,
    search: str | None,
    db: AsyncSession,
) -> AdminUserListResponse:
    """Retrieves paginated users for admin with submission and problem metrics."""
    count_stmt = select(func.count(User.id))
    query_stmt = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)

    if role is not None:
        count_stmt = count_stmt.where(User.role == role)
        query_stmt = query_stmt.where(User.role == role)

    if user_status is not None:
        count_stmt = count_stmt.where(User.status == user_status)
        query_stmt = query_stmt.where(User.status == user_status)

    if search:
        search_filter = or_(
            User.username.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        )
        count_stmt = count_stmt.where(search_filter)
        query_stmt = query_stmt.where(search_filter)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    users_result = await db.execute(query_stmt)
    users = users_result.scalars().all()

    if not users:
        return AdminUserListResponse(total=total, skip=skip, limit=limit, users=[])

    user_ids = [u.id for u in users]

    # Batch fetch submission counts for all users in one query (avoids N+1)
    sub_counts_stmt = (
        select(
            Submission.user_id,
            func.count(Submission.id).label("sub_count"),
        )
        .where(Submission.user_id.in_(user_ids))
        .group_by(Submission.user_id)
    )
    sub_count_map: dict[Any, int] = {
        row.user_id: row.sub_count for row in (await db.execute(sub_counts_stmt)).all()
    }

    # Batch fetch problem-created counts for all users in one query (avoids N+1)
    prob_counts_stmt = (
        select(
            Problem.created_by,
            func.count(Problem.id).label("prob_count"),
        )
        .where(
            Problem.created_by.in_(user_ids),
            Problem.is_deleted.is_(False),
        )
        .group_by(Problem.created_by)
    )
    prob_count_map: dict[Any, int] = {
        row.created_by: row.prob_count for row in (await db.execute(prob_counts_stmt)).all()
    }

    admin_users: list[AdminUserResponse] = [
        AdminUserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role,
            status=u.status,
            is_email_verified=u.is_email_verified,
            is_protected=u.is_protected,
            has_password=u.has_password,
            created_at=u.created_at,
            total_score=getattr(u, "total_score", 0.0) or 0.0,
            problems_solved=getattr(u, "problems_solved", 0) or 0,
            submissions_count=sub_count_map.get(u.id, 0),
            problems_created_count=prob_count_map.get(u.id, 0),
        )
        for u in users
    ]

    return AdminUserListResponse(
        total=total,
        skip=skip,
        limit=limit,
        users=admin_users,
    )


async def handle_get_admin_user_detail(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> AdminUserDetailResponse:
    """Retrieves detailed user profile including recent submissions and audit actions."""
    user = await _get_user_or_404(user_id, db)

    # Submissions count and recent submissions
    sub_count_stmt = select(func.count(Submission.id)).where(Submission.user_id == user.id)
    sub_count = (await db.execute(sub_count_stmt)).scalar_one()

    recent_subs_stmt = (
        select(Submission)
        .where(Submission.user_id == user.id)
        .order_by(Submission.created_at.desc())
        .limit(5)
    )
    recent_subs = (await db.execute(recent_subs_stmt)).scalars().all()
    recent_submissions = [
        {
            "id": str(s.id),
            "problem_id": s.problem_id,
            "language": s.language.value,
            "status": s.status.value,
            "created_at": s.created_at.isoformat(),
        }
        for s in recent_subs
    ]

    # Problems created count
    prob_count_stmt = select(func.count(Problem.id)).where(
        Problem.created_by == user.id, Problem.is_deleted.is_(False)
    )
    prob_count = (await db.execute(prob_count_stmt)).scalar_one()

    # Recent audit actions involving this user
    audit_stmt = (
        select(AuditLog)
        .where(or_(AuditLog.actor_id == user.id, AuditLog.target_id == str(user.id)))
        .order_by(AuditLog.created_at.desc())
        .limit(5)
    )
    audit_logs = (await db.execute(audit_stmt)).scalars().all()
    recent_audit_actions = [
        {
            "action": a.action,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
            "details": a.details,
        }
        for a in audit_logs
    ]

    return AdminUserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        status=user.status,
        is_email_verified=user.is_email_verified,
        is_protected=user.is_protected,
        has_password=user.has_password,
        created_at=user.created_at,
        submissions_count=sub_count,
        problems_created_count=prob_count,
        recent_submissions=recent_submissions,
        recent_audit_actions=recent_audit_actions,
    )


async def handle_update_user_role(
    admin_user: User,
    user_id: uuid.UUID,
    payload: AdminUpdateUserRoleRequest,
    request: Request,
    db: AsyncSession,
) -> AdminUserResponse:
    """Updates user role with self-lockout prevention and audit logging."""
    client_ip = request.client.host if request.client else None
    actor_id = admin_user.id
    actor_username = str(admin_user.username)
    actor_role = to_str_val(admin_user.role)

    # Self-lockout prevention
    if actor_id == user_id:
        await log_audit_event(
            db=db,
            action="security_violation",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={
                "attempted_role": to_str_val(payload.role),
                "reason": "Self-demotion prohibited",
            },
            error_message="Administrators cannot modify their own role.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot modify their own role.",
        )

    target_user = await _get_user_or_404(user_id, db)

    # Protected system account check
    if target_user.is_protected:
        await log_audit_event(
            db=db,
            action="security_violation",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={
                "attempted_role": to_str_val(payload.role),
                "reason": "Protected system account",
            },
            error_message="Protected system accounts cannot have their role modified.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Protected system accounts cannot have their role modified.",
        )

    old_role = to_str_val(target_user.role)
    new_role = to_str_val(payload.role)
    target_user.role = UserRole(new_role)

    try:
        await db.commit()
        await db.refresh(target_user)

        await log_audit_event(
            db=db,
            action="user_role_change",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="success",
            details={
                "old_role": old_role,
                "new_role": new_role,
                "target_username": target_user.username,
            },
            ip_address=client_ip,
        )

        logger.info(
            "Admin '{}' changed role for user '{}' from {} to {}",
            actor_username,
            target_user.username,
            old_role,
            new_role,
        )
        return AdminUserResponse.model_validate(target_user)

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update role for user {}: {}", user_id, exc)
        await log_audit_event(
            db=db,
            action="user_role_change",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={"old_role": old_role, "new_role": new_role},
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user role.",
        ) from exc


async def handle_update_user_status(
    admin_user: User,
    user_id: uuid.UUID,
    payload: AdminUpdateUserStatusRequest,
    request: Request,
    db: AsyncSession,
) -> AdminUserResponse:
    """Updates account status (active, inactive, suspended) with self-lockout prevention."""
    client_ip = request.client.host if request.client else None
    actor_id = admin_user.id
    actor_username = str(admin_user.username)
    actor_role = to_str_val(admin_user.role)
    target_status_str = to_str_val(payload.status)

    # Self-lockout prevention: Admin cannot deactivate or suspend own account
    if actor_id == user_id and target_status_str != "active":
        await log_audit_event(
            db=db,
            action="security_violation",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={"attempted_status": target_status_str, "reason": "Self-suspension prohibited"},
            error_message="Administrators cannot deactivate or suspend their own account.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate or suspend their own account.",
        )

    target_user = await _get_user_or_404(user_id, db)

    # Protected system account check
    if target_user.is_protected and target_status_str != "active":
        await log_audit_event(
            db=db,
            action="security_violation",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={"attempted_status": target_status_str, "reason": "Protected account"},
            error_message="Protected system accounts cannot be deactivated or suspended.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Protected system accounts cannot be deactivated or suspended.",
        )

    old_status = to_str_val(target_user.status)
    new_status = target_status_str
    target_user.status = UserStatus(new_status)

    try:
        await db.commit()
        await db.refresh(target_user)

        await log_audit_event(
            db=db,
            action="user_status_change",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="success",
            details={
                "old_status": old_status,
                "new_status": new_status,
                "target_username": target_user.username,
            },
            ip_address=client_ip,
        )

        logger.info(
            "Admin '{}' changed status for user '{}' from {} to {}",
            actor_username,
            target_user.username,
            old_status,
            new_status,
        )
        return AdminUserResponse.model_validate(target_user)

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update status for user {}: {}", user_id, exc)
        await log_audit_event(
            db=db,
            action="user_status_change",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={"old_status": old_status, "new_status": new_status},
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update account status.",
        ) from exc


async def handle_admin_update_user(
    admin_user: User,
    user_id: uuid.UUID,
    payload: AdminUpdateUserRequest,
    request: Request,
    db: AsyncSession,
) -> AdminUserResponse:
    """Comprehensive admin user update with conflict checks and audit logging."""
    client_ip = request.client.host if request.client else None
    actor_id = admin_user.id
    actor_username = str(admin_user.username)
    actor_role = to_str_val(admin_user.role)

    # Self-lockout checks
    if actor_id == user_id:
        if payload.role is not None and payload.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot modify their own role.",
            )
        if payload.status is not None and payload.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot deactivate or suspend their own account.",
            )

    target_user = await _get_user_or_404(user_id, db)

    if target_user.is_protected:
        if payload.status is not None and payload.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Protected system accounts cannot be deactivated or suspended.",
            )
        if payload.role is not None and payload.role != target_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Protected system accounts cannot have their role modified.",
            )

    changes: dict[str, Any] = {}

    if "name" in payload.model_fields_set and payload.name != target_user.name:
        changes["name"] = {"old": target_user.name, "new": payload.name}
        target_user.name = payload.name

    if payload.username is not None and payload.username != target_user.username:
        u_stmt = select(User.id).where(User.username == payload.username, User.id != user_id)
        if (await db.execute(u_stmt)).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{payload.username}' is already taken.",
            )
        changes["username"] = {"old": target_user.username, "new": payload.username}
        target_user.username = payload.username

    if payload.email is not None and payload.email != target_user.email:
        e_stmt = select(User.id).where(User.email == payload.email, User.id != user_id)
        if (await db.execute(e_stmt)).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{payload.email}' is already registered.",
            )
        changes["email"] = {"old": target_user.email, "new": payload.email}
        target_user.email = payload.email

    if payload.password is not None:
        target_user.password_hash = hash_password(payload.password)
        changes["password"] = "password_updated"

    if payload.role is not None and payload.role != target_user.role:
        changes["role"] = {"old": target_user.role.value, "new": payload.role.value}
        target_user.role = payload.role

    if payload.status is not None and payload.status != target_user.status:
        changes["status"] = {"old": target_user.status.value, "new": payload.status.value}
        target_user.status = payload.status

    if payload.is_email_verified is not None:
        changes["is_email_verified"] = {
            "old": target_user.is_email_verified,
            "new": payload.is_email_verified,
        }
        target_user.is_email_verified = payload.is_email_verified

    if payload.is_protected is not None:
        changes["is_protected"] = {"old": target_user.is_protected, "new": payload.is_protected}
        target_user.is_protected = payload.is_protected

    try:
        await db.commit()
        await db.refresh(target_user)

        await log_audit_event(
            db=db,
            action="user_update",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="success",
            details=changes,
            ip_address=client_ip,
        )

        return AdminUserResponse.model_validate(target_user)

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update user {}: {}", user_id, exc)
        await log_audit_event(
            db=db,
            action="user_update",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details=changes,
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile.",
        ) from exc


async def handle_admin_delete_user(
    admin_user: User,
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession,
) -> MessageResponse:
    """Safely deletes user account with self-delete and protected account protections."""
    client_ip = request.client.host if request.client else None
    actor_id = admin_user.id
    actor_username = str(admin_user.username)
    actor_role = to_str_val(admin_user.role)

    # Self-delete prevention
    if actor_id == user_id:
        await log_audit_event(
            db=db,
            action="security_violation",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={"reason": "Self-deletion prohibited"},
            error_message="Administrators cannot delete their own account.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account.",
        )

    target_user = await _get_user_or_404(user_id, db)

    if target_user.is_protected:
        await log_audit_event(
            db=db,
            action="security_violation",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            details={"reason": "Protected account deletion prohibited"},
            error_message="Protected system accounts cannot be deleted.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Protected system accounts cannot be deleted.",
        )

    deleted_username = target_user.username
    try:
        await db.delete(target_user)
        await db.commit()

        await log_audit_event(
            db=db,
            action="user_delete",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="success",
            details={"deleted_username": deleted_username},
            ip_address=client_ip,
        )

        return MessageResponse(message=f"User '{deleted_username}' was successfully deleted.")

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to delete user {}: {}", user_id, exc)
        await log_audit_event(
            db=db,
            action="user_delete",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="user",
            target_id=str(user_id),
            status="failure",
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user.",
        ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# Statistics and Dashboard Handlers
# ─────────────────────────────────────────────────────────────────────────────


async def handle_get_user_stats(
    days: int,
    db: AsyncSession,
) -> UserStatsResponse:
    """Calculates user statistics using efficient SQL aggregations."""
    # Total users
    total_result = await db.execute(select(func.count(User.id)))
    total_users = total_result.scalar_one()

    # By role
    role_stmt = select(User.role, func.count(User.id)).group_by(User.role)
    role_rows = (await db.execute(role_stmt)).all()
    by_role = {r.value if hasattr(r, "value") else str(r): count for r, count in role_rows}
    # Ensure default roles are present
    for r in ("user", "moderator", "admin"):
        by_role.setdefault(r, 0)

    # By status
    status_stmt = select(User.status, func.count(User.id)).group_by(User.status)
    status_rows = (await db.execute(status_stmt)).all()
    by_status = {s.value if hasattr(s, "value") else str(s): count for s, count in status_rows}
    for s in ("active", "inactive", "suspended"):
        by_status.setdefault(s, 0)

    # New registrations in period
    cutoff = datetime.now(UTC) - timedelta(days=days)
    period_stmt = select(func.count(User.id)).where(User.created_at >= cutoff)
    new_in_period = (await db.execute(period_stmt)).scalar_one()

    # Registrations trend (daily aggregation)
    registrations_trend = await _fetch_daily_trend(db, User.created_at, User.id, cutoff)

    return UserStatsResponse(
        total_users=total_users,
        by_role=by_role,
        by_status=by_status,
        new_registrations_in_period=new_in_period,
        registrations_trend=registrations_trend,
    )


async def handle_get_problem_stats(
    db: AsyncSession,
) -> ProblemStatsResponse:
    """Calculates problem statistics grouped by difficulty, category, topic, status."""
    # Total active problems
    total_active = (
        await db.execute(select(func.count(Problem.id)).where(Problem.is_deleted.is_(False)))
    ).scalar_one()
    # Total including deleted
    total_all = (await db.execute(select(func.count(Problem.id)))).scalar_one()

    # By difficulty
    diff_stmt = (
        select(Problem.difficulty, func.count(Problem.id))
        .where(Problem.is_deleted.is_(False))
        .group_by(Problem.difficulty)
    )
    diff_rows = (await db.execute(diff_stmt)).all()
    by_diff = {d.value if hasattr(d, "value") else str(d): count for d, count in diff_rows}
    for d in ("easy", "medium", "hard"):
        by_diff.setdefault(d, 0)

    # By category
    cat_stmt = (
        select(Problem.category, func.count(Problem.id))
        .where(Problem.is_deleted.is_(False))
        .group_by(Problem.category)
    )
    cat_rows = (await db.execute(cat_stmt)).all()
    by_category = {str(c): count for c, count in cat_rows}

    # By topic (array, tree, linkedlist, recursion, etc.)
    topic_stmt = (
        select(Problem.topic, func.count(Problem.id))
        .where(Problem.is_deleted.is_(False))
        .group_by(Problem.topic)
    )
    topic_rows = (await db.execute(topic_stmt)).all()
    by_topic = {str(t): count for t, count in topic_rows}

    # By status (published, unpublished, draft, archived)
    stat_stmt = (
        select(Problem.status, func.count(Problem.id))
        .where(Problem.is_deleted.is_(False))
        .group_by(Problem.status)
    )
    stat_rows = (await db.execute(stat_stmt)).all()
    by_status = {s.value if hasattr(s, "value") else str(s): count for s, count in stat_rows}
    for s in ("published", "unpublished", "draft", "archived"):
        by_status.setdefault(s, 0)

    # Problems created by each moderator
    mod_stmt = (
        select(User.id, User.username, func.count(Problem.id))
        .join(Problem, Problem.created_by == User.id)
        .where(Problem.is_deleted.is_(False))
        .group_by(User.id, User.username)
    )
    mod_rows = (await db.execute(mod_stmt)).all()
    problems_by_moderator = [
        ModeratorProblemCount(
            moderator_id=str(r[0]),
            username=r[1],
            count=r[2],
        )
        for r in mod_rows
    ]

    # Recently created
    recent_created_stmt = (
        select(Problem)
        .where(Problem.is_deleted.is_(False))
        .order_by(Problem.created_at.desc())
        .limit(5)
    )
    recently_created = (await db.execute(recent_created_stmt)).scalars().all()

    # Recently updated
    recent_updated_stmt = (
        select(Problem)
        .where(Problem.is_deleted.is_(False))
        .order_by(Problem.updated_at.desc())
        .limit(5)
    )
    recently_updated = (await db.execute(recent_updated_stmt)).scalars().all()

    # Recently deleted
    recent_deleted_stmt = (
        select(Problem)
        .where(Problem.is_deleted.is_(True))
        .order_by(Problem.deleted_at.desc())
        .limit(5)
    )
    recently_deleted = (await db.execute(recent_deleted_stmt)).scalars().all()

    return ProblemStatsResponse(
        total_problems=total_active,
        total_including_deleted=total_all,
        by_difficulty=by_diff,
        by_category=by_category,
        by_topic=by_topic,
        by_status=by_status,
        problems_by_moderator=problems_by_moderator,
        recently_created=[ProblemResponse.model_validate(p) for p in recently_created],
        recently_updated=[ProblemResponse.model_validate(p) for p in recently_updated],
        recently_deleted=[ProblemResponse.model_validate(p) for p in recently_deleted],
    )


async def handle_get_submission_stats(
    days: int,
    db: AsyncSession,
) -> SubmissionStatsResponse:
    """Calculates submission statistics and error breakdowns via SQL aggregation."""
    total_submissions = (await db.execute(select(func.count(Submission.id)))).scalar_one()

    # Group by status
    status_stmt = select(Submission.status, func.count(Submission.id)).group_by(Submission.status)
    status_rows = (await db.execute(status_stmt)).all()
    status_map = {s.value if hasattr(s, "value") else str(s): count for s, count in status_rows}

    accepted = status_map.get("accepted", 0)
    compilation_errors = status_map.get("compilation_error", 0)
    runtime_errors = status_map.get("runtime_error", 0)
    time_limit_exceeded = status_map.get("time_limit_exceeded", 0)
    memory_limit_exceeded = status_map.get("memory_limit_exceeded", 0)

    # Total rejected = all terminal non-accepted submissions
    rejected = (
        status_map.get("wrong_answer", 0)
        + compilation_errors
        + runtime_errors
        + time_limit_exceeded
        + memory_limit_exceeded
        + status_map.get("internal_error", 0)
    )

    evaluated_total = accepted + rejected
    success_rate = round((accepted / evaluated_total) * 100.0, 2) if evaluated_total > 0 else 0.0

    # Submissions trend over time
    cutoff = datetime.now(UTC) - timedelta(days=days)
    submissions_trend = await _fetch_daily_trend(db, Submission.created_at, Submission.id, cutoff)

    return SubmissionStatsResponse(
        total_submissions=total_submissions,
        accepted=accepted,
        rejected=rejected,
        compilation_errors=compilation_errors,
        runtime_errors=runtime_errors,
        time_limit_exceeded=time_limit_exceeded,
        memory_limit_exceeded=memory_limit_exceeded,
        success_rate=success_rate,
        submissions_trend=submissions_trend,
    )


async def handle_get_activity_stats(
    db: AsyncSession,
) -> SystemActivityStatsResponse:
    """Retrieves recent admin actions, moderator activity, and creation trends."""
    cutoff = datetime.now(UTC) - timedelta(days=30)

    # Recent admin actions
    admin_stmt = (
        select(AuditLog)
        .where(AuditLog.actor_role == "admin")
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    )
    admin_actions = (await db.execute(admin_stmt)).scalars().all()

    # Recent moderator activity
    mod_stmt = (
        select(AuditLog)
        .where(AuditLog.actor_role == "moderator")
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    )
    mod_actions = (await db.execute(mod_stmt)).scalars().all()

    # User and problem creation trends
    user_creation_trend = await _fetch_daily_trend(db, User.created_at, User.id, cutoff)
    problem_creation_trend = await _fetch_daily_trend(db, Problem.created_at, Problem.id, cutoff)

    return SystemActivityStatsResponse(
        recent_admin_actions=[AuditLogResponse.model_validate(a) for a in admin_actions],
        recent_moderator_activity=[AuditLogResponse.model_validate(m) for m in mod_actions],
        user_creation_trend=user_creation_trend,
        problem_creation_trend=problem_creation_trend,
    )


async def handle_get_dashboard_stats(
    days: int,
    db: AsyncSession,
) -> DashboardStatsResponse:
    """Provides consolidated statistics dashboard for administrators."""
    users_stats = await handle_get_user_stats(days=days, db=db)
    problem_stats = await handle_get_problem_stats(db=db)
    submission_stats = await handle_get_submission_stats(days=days, db=db)
    activity_stats = await handle_get_activity_stats(db=db)

    return DashboardStatsResponse(
        users=users_stats,
        problems=problem_stats,
        submissions=submission_stats,
        activity=activity_stats,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Audit Log Queries
# ─────────────────────────────────────────────────────────────────────────────


async def handle_list_audit_logs(
    skip: int,
    limit: int,
    action: str | None,
    actor_id: uuid.UUID | None,
    actor_role: str | None,
    target_type: str | None,
    log_status: str | None,
    start_date: datetime | None,
    end_date: datetime | None,
    db: AsyncSession,
) -> AuditLogListResponse:
    """Retrieves paginated audit log entries with granular filtering."""
    count_stmt = select(func.count(AuditLog.id))
    query_stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)

    if action:
        count_stmt = count_stmt.where(AuditLog.action == action)
        query_stmt = query_stmt.where(AuditLog.action == action)

    if actor_id:
        count_stmt = count_stmt.where(AuditLog.actor_id == actor_id)
        query_stmt = query_stmt.where(AuditLog.actor_id == actor_id)

    if actor_role:
        count_stmt = count_stmt.where(AuditLog.actor_role == actor_role)
        query_stmt = query_stmt.where(AuditLog.actor_role == actor_role)

    if target_type:
        count_stmt = count_stmt.where(AuditLog.target_type == target_type)
        query_stmt = query_stmt.where(AuditLog.target_type == target_type)

    if log_status:
        count_stmt = count_stmt.where(AuditLog.status == log_status)
        query_stmt = query_stmt.where(AuditLog.status == log_status)

    if start_date:
        count_stmt = count_stmt.where(AuditLog.created_at >= start_date)
        query_stmt = query_stmt.where(AuditLog.created_at >= start_date)

    if end_date:
        count_stmt = count_stmt.where(AuditLog.created_at <= end_date)
        query_stmt = query_stmt.where(AuditLog.created_at <= end_date)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    logs_result = await db.execute(query_stmt)
    logs = logs_result.scalars().all()

    return AuditLogListResponse(
        total=total,
        skip=skip,
        limit=limit,
        logs=[AuditLogResponse.model_validate(item) for item in logs],
    )


async def handle_get_audit_log(
    log_id: uuid.UUID,
    db: AsyncSession,
) -> AuditLogResponse:
    """Retrieves a single audit log record by UUID."""
    stmt = select(AuditLog).where(AuditLog.id == log_id)
    result = await db.execute(stmt)
    log_entry = result.scalar_one_or_none()

    if log_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log with ID '{log_id}' not found.",
        )

    return AuditLogResponse.model_validate(log_entry)
