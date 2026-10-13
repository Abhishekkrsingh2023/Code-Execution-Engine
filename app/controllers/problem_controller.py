from fastapi import HTTPException, Request, status
from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import _utcnow
from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.user import User
from app.schemas.problem import (
    ProblemCreateRequest,
    ProblemListResponse,
    ProblemResponse,
    ProblemStatusUpdateRequest,
    ProblemUpdateRequest,
)
from app.schemas.user import MessageResponse
from app.utils.audit_logger import log_audit_event, to_str_val


async def handle_create_problem(
    user: User,
    payload: ProblemCreateRequest,
    request: Request,
    db: AsyncSession,
) -> ProblemResponse:
    """Creates a new problem authored by a moderator or administrator.

    Records an audit log entry for the problem creation.
    """
    client_ip = request.client.host if request.client else None
    actor_id = user.id
    actor_username = str(user.username)
    actor_role = to_str_val(user.role)

    new_problem = Problem(
        title=payload.title,
        description=payload.description,
        difficulty=payload.difficulty,
        category=payload.category,
        topic=payload.topic,
        time_limit=payload.time_limit,
        memory_limit=payload.memory_limit,
        status=payload.status,
        created_by=actor_id,
    )

    try:
        db.add(new_problem)
        await db.commit()
        await db.refresh(new_problem)

        await log_audit_event(
            db=db,
            action="problem_create",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(new_problem.id),
            status="success",
            details={
                "title": new_problem.title,
                "difficulty": to_str_val(new_problem.difficulty),
                "category": new_problem.category,
                "topic": new_problem.topic,
                "status": to_str_val(new_problem.status),
            },
            ip_address=client_ip,
        )

        logger.info(
            "User '{}' ({}) created problem #{} '{}' [topic: {}]",
            actor_username,
            actor_role,
            new_problem.id,
            new_problem.title,
            new_problem.topic,
        )
        return ProblemResponse.model_validate(new_problem)

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to create problem: {}", exc)
        await log_audit_event(
            db=db,
            action="problem_create",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            status="failure",
            details={"title": payload.title, "topic": payload.topic},
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create problem due to an internal error.",
        ) from exc


async def handle_update_problem(
    user: User,
    problem_id: int,
    payload: ProblemUpdateRequest,
    request: Request,
    db: AsyncSession,
) -> ProblemResponse:
    """Updates problem attributes by moderator or admin, recording an audit log."""
    client_ip = request.client.host if request.client else None
    actor_id = user.id
    actor_username = str(user.username)
    actor_role = to_str_val(user.role)

    stmt = select(Problem).where(Problem.id == problem_id, Problem.is_deleted.is_(False))
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with ID {problem_id} not found.",
        )

    changes: dict[str, dict[str, str]] = {}
    if payload.title is not None and payload.title != problem.title:
        changes["title"] = {"old": problem.title, "new": payload.title}
        problem.title = payload.title
    if payload.description is not None and payload.description != problem.description:
        changes["description"] = {"old": problem.description[:50], "new": payload.description[:50]}
        problem.description = payload.description
    if payload.difficulty is not None and payload.difficulty != problem.difficulty:
        changes["difficulty"] = {
            "old": to_str_val(problem.difficulty),
            "new": to_str_val(payload.difficulty),
        }
        problem.difficulty = payload.difficulty
    if payload.category is not None and payload.category != problem.category:
        changes["category"] = {"old": problem.category, "new": payload.category}
        problem.category = payload.category
    if payload.topic is not None and payload.topic != problem.topic:
        changes["topic"] = {"old": problem.topic, "new": payload.topic}
        problem.topic = payload.topic
    if payload.time_limit is not None and payload.time_limit != problem.time_limit:
        changes["time_limit"] = {"old": str(problem.time_limit), "new": str(payload.time_limit)}
        problem.time_limit = payload.time_limit
    if payload.memory_limit is not None and payload.memory_limit != problem.memory_limit:
        changes["memory_limit"] = {
            "old": str(problem.memory_limit),
            "new": str(payload.memory_limit),
        }
        problem.memory_limit = payload.memory_limit
    if payload.status is not None and payload.status != problem.status:
        changes["status"] = {"old": to_str_val(problem.status), "new": to_str_val(payload.status)}
        problem.status = payload.status

    try:
        problem.updated_at = _utcnow()
        await db.commit()
        await db.refresh(problem)

        await log_audit_event(
            db=db,
            action="problem_update",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(problem_id),
            status="success",
            details=changes,
            ip_address=client_ip,
        )

        return ProblemResponse.model_validate(problem)

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update problem {}: {}", problem_id, exc)
        await log_audit_event(
            db=None,
            action="problem_update",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(problem_id),
            status="failure",
            details=changes,
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update problem.",
        ) from exc


async def handle_update_problem_status(
    user: User,
    problem_id: int,
    payload: ProblemStatusUpdateRequest,
    request: Request,
    db: AsyncSession,
) -> ProblemResponse:
    """Updates publication status (published, unpublished, draft, archived) and audit-logs."""
    client_ip = request.client.host if request.client else None
    actor_id = user.id
    actor_username = str(user.username)
    actor_role = to_str_val(user.role)

    stmt = select(Problem).where(Problem.id == problem_id, Problem.is_deleted.is_(False))
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with ID {problem_id} not found.",
        )

    old_status = to_str_val(problem.status)
    new_status = to_str_val(payload.status)
    problem.status = payload.status
    problem.updated_at = _utcnow()

    try:
        await db.commit()
        await db.refresh(problem)

        await log_audit_event(
            db=db,
            action="problem_status_change",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(problem_id),
            status="success",
            details={"old_status": old_status, "new_status": new_status},
            ip_address=client_ip,
        )

        return ProblemResponse.model_validate(problem)

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update problem publication status for {}: {}", problem_id, exc)
        await log_audit_event(
            db=None,
            action="problem_status_change",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(problem_id),
            status="failure",
            details={"old_status": old_status, "new_status": new_status},
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update publication status.",
        ) from exc


async def handle_delete_problem(
    user: User,
    problem_id: int,
    request: Request,
    db: AsyncSession,
) -> MessageResponse:
    """Soft-deletes a problem by moderator or admin, recording an audit log."""
    client_ip = request.client.host if request.client else None
    actor_id = user.id
    actor_username = str(user.username)
    actor_role = to_str_val(user.role)

    stmt = select(Problem).where(Problem.id == problem_id, Problem.is_deleted.is_(False))
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with ID {problem_id} not found.",
        )

    problem.is_deleted = True
    problem.deleted_at = _utcnow()

    try:
        await db.commit()

        await log_audit_event(
            db=db,
            action="problem_delete",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(problem_id),
            status="success",
            details={"title": problem.title, "topic": problem.topic},
            ip_address=client_ip,
        )

        return MessageResponse(
            message=f"Problem '{problem.title}' (ID {problem_id}) deleted successfully."
        )

    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to delete problem {}: {}", problem_id, exc)
        await log_audit_event(
            db=db,
            action="problem_delete",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            target_type="problem",
            target_id=str(problem_id),
            status="failure",
            error_message=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete problem.",
        ) from exc


async def handle_list_problems(
    skip: int,
    limit: int,
    difficulty: ProblemDifficulty | None,
    category: str | None,
    topic: str | None,
    problem_status: ProblemStatus | None,
    search: str | None,
    db: AsyncSession,
) -> ProblemListResponse:
    """Retrieves paginated list of non-deleted problems with filters."""
    count_stmt = select(func.count(Problem.id)).where(Problem.is_deleted.is_(False))
    query_stmt = (
        select(Problem)
        .where(Problem.is_deleted.is_(False))
        .order_by(Problem.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    if difficulty is not None:
        count_stmt = count_stmt.where(Problem.difficulty == difficulty)
        query_stmt = query_stmt.where(Problem.difficulty == difficulty)

    if category is not None:
        count_stmt = count_stmt.where(func.lower(Problem.category) == func.lower(category))
        query_stmt = query_stmt.where(func.lower(Problem.category) == func.lower(category))

    if topic is not None:
        count_stmt = count_stmt.where(func.lower(Problem.topic) == func.lower(topic))
        query_stmt = query_stmt.where(func.lower(Problem.topic) == func.lower(topic))

    if problem_status is not None:
        count_stmt = count_stmt.where(Problem.status == problem_status)
        query_stmt = query_stmt.where(Problem.status == problem_status)

    if search:
        search_filter = or_(
            Problem.title.ilike(f"%{search}%"),
            Problem.description.ilike(f"%{search}%"),
            Problem.topic.ilike(f"%{search}%"),
        )
        count_stmt = count_stmt.where(search_filter)
        query_stmt = query_stmt.where(search_filter)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    problems_result = await db.execute(query_stmt)
    problems = problems_result.scalars().all()

    return ProblemListResponse(
        total=total,
        skip=skip,
        limit=limit,
        problems=[ProblemResponse.model_validate(p) for p in problems],
    )


async def handle_get_problem(
    problem_id: int,
    db: AsyncSession,
) -> ProblemResponse:
    """Retrieves single problem by ID."""
    stmt = select(Problem).where(Problem.id == problem_id, Problem.is_deleted.is_(False))
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with ID {problem_id} not found.",
        )

    return ProblemResponse.model_validate(problem)
