import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, Request, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.code_controller import (
    handle_run_code_request,
    handle_submit_code_request,
)
from app.models.audit_log import AuditLogAction, AuditLogStatus
from app.models.contest import Contest, ContestParticipant, ContestProblem, ContestStatus
from app.models.problem import Problem
from app.models.problem_template import CommonProblemTemplate
from app.models.submission import Submission
from app.models.test_case import TestCase as TestCaseModel
from app.models.user import User, UserRole
from app.schemas.contest import (
    ContestCreateRequest,
    ContestLeaderboardResponse,
    ContestListResponse,
    ContestParticipantResponse,
    ContestProblemAssignRequest,
    ContestProblemDetailResponse,
    ContestProblemResponse,
    ContestProblemUpdateRequest,
    ContestResponse,
    ContestRunRequest,
    ContestSubmissionListResponse,
    ContestSubmissionResponse,
    ContestSubmitRequest,
    ContestUpdateRequest,
)
from app.schemas.submission import RunRequest, SubmitRequest
from app.schemas.user import MessageResponse
from app.services.contest_service import (
    get_contest_leaderboard_data,
    get_user_contest_rank_data,
    sync_contest_status,
)
from app.utils.audit_logger import log_audit_event


def _is_staff(user: User | None) -> bool:
    return user is not None and user.role in (UserRole.ADMIN, UserRole.MODERATOR)


def _build_contest_response(
    contest: Contest,
    now: datetime,
    is_registered: bool = False,
    include_problems: bool = True,
    participant_count: int | None = None,
) -> ContestResponse:
    effective_status = contest.get_effective_status(now)
    problem_responses: list[ContestProblemResponse] = []
    if include_problems and contest.contest_problems:
        problem_responses = [
            ContestProblemResponse(
                id=cp.id,
                problem_id=cp.problem_id,
                title=cp.problem.title if cp.problem else f"Problem #{cp.problem_id}",
                difficulty=cp.problem.difficulty.value if cp.problem else "medium",
                points=cp.points,
                order_index=cp.order_index,
            )
            for cp in contest.contest_problems
        ]

    p_count = (
        participant_count
        if participant_count is not None
        else (len(contest.participants) if contest.participants else 0)
    )

    return ContestResponse(
        id=contest.id,
        title=contest.title,
        description=contest.description,
        start_time=contest.start_time,
        end_time=contest.end_time,
        duration_seconds=contest.duration_seconds,
        status=effective_status.value,
        stored_status=contest.status.value,
        penalty_minutes=contest.penalty_minutes,
        participant_count=p_count,
        problem_count=len(contest.contest_problems) if contest.contest_problems else 0,
        is_registered=is_registered,
        created_by=contest.created_by,
        created_at=contest.created_at,
        problems=problem_responses,
    )


async def handle_create_contest(
    payload: ContestCreateRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestResponse:
    now = datetime.now(UTC)
    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contest end_time must be strictly after start_time.",
        )

    # Initial status
    initial_status = ContestStatus(payload.status)
    if initial_status not in (ContestStatus.DRAFT, ContestStatus.UPCOMING):
        initial_status = ContestStatus.UPCOMING

    contest = Contest(
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=initial_status,
        penalty_minutes=payload.penalty_minutes,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(contest)
    await db.commit()
    await db.refresh(contest)

    await log_audit_event(
        db,
        action=AuditLogAction.CONTEST_CREATE.value,
        actor=current_user,
        request=request,
        target_type="contest",
        target_id=str(contest.id),
        status=AuditLogStatus.SUCCESS.value,
        details={
            "title": contest.title,
            "start_time": contest.start_time.isoformat(),
            "end_time": contest.end_time.isoformat(),
            "status": contest.status.value,
            "penalty_minutes": contest.penalty_minutes,
        },
    )

    logger.info("User '{}' created contest '{}' ({})", current_user.username, contest.title, contest.id)
    return _build_contest_response(contest, now, is_registered=False, include_problems=True)


async def handle_list_contests(
    skip: int,
    limit: int,
    contest_status: str | None,
    search: str | None,
    current_user: User | None,
    db: AsyncSession,
) -> ContestListResponse:
    now = datetime.now(UTC)
    is_staff_user = _is_staff(current_user)

    stmt = select(Contest)

    # Restrict hidden states (DRAFT) for non-staff
    if not is_staff_user:
        stmt = stmt.where(Contest.status != ContestStatus.DRAFT)

    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            Contest.title.ilike(search_pattern) | Contest.description.ilike(search_pattern)
        )

    stmt = stmt.order_by(Contest.start_time.desc())
    all_contests = (await db.execute(stmt)).scalars().all()

    # Filter by effective status if requested
    filtered_contests: list[Contest] = []
    for c in all_contests:
        eff = c.get_effective_status(now)
        if contest_status:
            target_status = contest_status.lower()
            if eff.value == target_status or c.status.value == target_status:
                filtered_contests.append(c)
        else:
            filtered_contests.append(c)

    total = len(filtered_contests)
    paginated = filtered_contests[skip : skip + limit]

    # Pre-fetch user registrations
    registered_contest_ids: set[uuid.UUID] = set()
    if current_user:
        stmt_part = select(ContestParticipant.contest_id).where(
            ContestParticipant.user_id == current_user.id
        )
        part_res = (await db.execute(stmt_part)).scalars().all()
        registered_contest_ids = set(part_res)

    contest_responses = [
        _build_contest_response(
            c,
            now,
            is_registered=(c.id in registered_contest_ids),
            include_problems=is_staff_user or c.get_effective_status(now) in (ContestStatus.ACTIVE, ContestStatus.COMPLETED),
        )
        for c in paginated
    ]

    return ContestListResponse(
        total=total,
        skip=skip,
        limit=limit,
        contests=contest_responses,
    )


async def handle_get_contest(
    contest_id: uuid.UUID,
    current_user: User | None,
    db: AsyncSession,
) -> ContestResponse:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()

    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    is_staff_user = _is_staff(current_user)
    if contest.status == ContestStatus.DRAFT and not is_staff_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    await sync_contest_status(contest, db, now)

    is_registered = False
    if current_user:
        stmt_part = select(ContestParticipant).where(
            ContestParticipant.contest_id == contest.id,
            ContestParticipant.user_id == current_user.id,
        )
        is_registered = (await db.execute(stmt_part)).scalar_one_or_none() is not None

    effective_status = contest.get_effective_status(now)
    # Hide problems before start time for regular users
    show_problems = is_staff_user or effective_status in (
        ContestStatus.ACTIVE,
        ContestStatus.COMPLETED,
    )

    stmt_count = select(func.count(ContestParticipant.id)).where(
        ContestParticipant.contest_id == contest.id
    )
    p_count = (await db.execute(stmt_count)).scalar_one()

    return _build_contest_response(
        contest,
        now,
        is_registered=is_registered,
        include_problems=show_problems,
        participant_count=p_count,
    )


async def handle_update_contest(
    contest_id: uuid.UUID,
    payload: ContestUpdateRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestResponse:
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()

    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    new_start = payload.start_time or contest.start_time
    new_end = payload.end_time or contest.end_time
    if new_end <= new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contest end_time must be strictly after start_time.",
        )

    changes: dict[str, Any] = {}
    if payload.title is not None and payload.title != contest.title:
        changes["title"] = payload.title
        contest.title = payload.title
    if payload.description is not None:
        changes["description"] = payload.description
        contest.description = payload.description
    if payload.start_time is not None:
        changes["start_time"] = payload.start_time.isoformat()
        contest.start_time = payload.start_time
    if payload.end_time is not None:
        changes["end_time"] = payload.end_time.isoformat()
        contest.end_time = payload.end_time
    if payload.status is not None:
        changes["status"] = payload.status
        contest.status = ContestStatus(payload.status)
    if payload.penalty_minutes is not None:
        changes["penalty_minutes"] = payload.penalty_minutes
        contest.penalty_minutes = payload.penalty_minutes

    contest.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(contest)

    await log_audit_event(
        db,
        action=AuditLogAction.CONTEST_UPDATE.value,
        actor=current_user,
        request=request,
        target_type="contest",
        target_id=str(contest.id),
        status=AuditLogStatus.SUCCESS.value,
        details=changes,
    )

    now = datetime.now(UTC)
    return _build_contest_response(contest, now, is_registered=False, include_problems=True)


async def handle_delete_contest(
    contest_id: uuid.UUID,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> MessageResponse:
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()

    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    title = contest.title
    await db.delete(contest)
    await db.commit()

    await log_audit_event(
        db,
        action=AuditLogAction.CONTEST_DELETE.value,
        actor=current_user,
        request=request,
        target_type="contest",
        target_id=str(contest_id),
        status=AuditLogStatus.SUCCESS.value,
        details={"deleted_title": title},
    )

    logger.info("User '{}' deleted contest '{}' ({})", current_user.username, title, contest_id)
    return MessageResponse(message=f"Contest '{title}' has been deleted successfully.")


async def handle_register_contest(
    contest_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> ContestParticipantResponse:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()

    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    eff_status = contest.get_effective_status(now)
    if eff_status == ContestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register for a completed contest.",
        )
    if eff_status == ContestStatus.CANCELLED or contest.status == ContestStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register for a cancelled contest.",
        )
    if contest.status == ContestStatus.DRAFT and not _is_staff(current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    # Check existing registration
    stmt_exist = select(ContestParticipant).where(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == current_user.id,
    )
    existing = (await db.execute(stmt_exist)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already registered for this contest.",
        )

    participant = ContestParticipant(
        contest_id=contest_id,
        user_id=current_user.id,
        registered_at=now,
        score=0.0,
        problems_solved=0,
        penalty_seconds=0,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)

    logger.info("User '{}' registered for contest '{}'", current_user.username, contest.title)
    return ContestParticipantResponse(
        id=participant.id,
        user_id=current_user.id,
        username=current_user.username,
        name=current_user.name,
        registered_at=participant.registered_at,
        score=participant.score,
        problems_solved=participant.problems_solved,
        penalty_seconds=participant.penalty_seconds,
        rank=participant.rank,
    )


async def handle_unregister_contest(
    contest_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> MessageResponse:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()

    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    eff_status = contest.get_effective_status(now)
    if eff_status != ContestStatus.UPCOMING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only unregister before the contest starts.",
        )

    stmt_part = select(ContestParticipant).where(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == current_user.id,
    )
    participant = (await db.execute(stmt_part)).scalar_one_or_none()
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not registered for this contest.",
        )

    await db.delete(participant)
    await db.commit()

    logger.info("User '{}' unregistered from contest '{}'", current_user.username, contest.title)
    return MessageResponse(message="Successfully unregistered from the contest.")


async def handle_assign_problem(
    contest_id: uuid.UUID,
    payload: ContestProblemAssignRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestProblemResponse:
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    stmt_prob = select(Problem).where(
        Problem.id == payload.problem_id, Problem.is_deleted.is_(False)
    )
    problem = (await db.execute(stmt_prob)).scalar_one_or_none()
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{payload.problem_id} does not exist or has been deleted.",
        )

    # Check duplicate assignment
    stmt_exist = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    )
    existing = (await db.execute(stmt_exist)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Problem #{payload.problem_id} is already assigned to this contest.",
        )

    # Determine order index if not provided
    if payload.order_index is None:
        max_order_stmt = select(func.coalesce(func.max(ContestProblem.order_index), -1)).where(
            ContestProblem.contest_id == contest_id
        )
        max_order = (await db.execute(max_order_stmt)).scalar_one()
        order_index = max_order + 1
    else:
        order_index = payload.order_index

    cp = ContestProblem(
        contest_id=contest_id,
        problem_id=payload.problem_id,
        points=payload.points,
        order_index=order_index,
    )
    db.add(cp)
    await db.commit()
    await db.refresh(cp)

    await log_audit_event(
        db,
        action=AuditLogAction.CONTEST_PROBLEM_ASSIGN.value,
        actor=current_user,
        request=request,
        target_type="contest",
        target_id=str(contest_id),
        status=AuditLogStatus.SUCCESS.value,
        details={
            "problem_id": problem.id,
            "problem_title": problem.title,
            "points": cp.points,
            "order_index": cp.order_index,
        },
    )

    logger.info("Assigned problem #{} to contest #{}", problem.id, contest_id)
    return ContestProblemResponse(
        id=cp.id,
        problem_id=cp.problem_id,
        title=problem.title,
        difficulty=problem.difficulty.value,
        points=cp.points,
        order_index=cp.order_index,
    )


async def handle_remove_problem(
    contest_id: uuid.UUID,
    problem_id: int,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> MessageResponse:
    stmt = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == problem_id,
    )
    cp = (await db.execute(stmt)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{problem_id} is not assigned to this contest.",
        )

    await db.delete(cp)
    await db.commit()

    await log_audit_event(
        db,
        action=AuditLogAction.CONTEST_PROBLEM_REMOVE.value,
        actor=current_user,
        request=request,
        target_type="contest",
        target_id=str(contest_id),
        status=AuditLogStatus.SUCCESS.value,
        details={"removed_problem_id": problem_id},
    )

    logger.info("Removed problem #{} from contest #{}", problem_id, contest_id)
    return MessageResponse(message=f"Problem #{problem_id} removed from contest.")


async def handle_update_problem_in_contest(
    contest_id: uuid.UUID,
    problem_id: int,
    payload: ContestProblemUpdateRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestProblemResponse:
    stmt = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == problem_id,
    )
    cp = (await db.execute(stmt)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{problem_id} is not assigned to this contest.",
        )

    if payload.points is not None:
        cp.points = payload.points
    if payload.order_index is not None:
        cp.order_index = payload.order_index

    await db.commit()
    await db.refresh(cp)

    stmt_prob = select(Problem).where(Problem.id == problem_id)
    prob = (await db.execute(stmt_prob)).scalar_one_or_none()

    return ContestProblemResponse(
        id=cp.id,
        problem_id=cp.problem_id,
        title=prob.title if prob else f"Problem #{problem_id}",
        difficulty=prob.difficulty.value if prob else "medium",
        points=cp.points,
        order_index=cp.order_index,
    )


async def handle_get_contest_problems(
    contest_id: uuid.UUID,
    current_user: User | None,
    db: AsyncSession,
) -> list[ContestProblemResponse]:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    is_staff_user = _is_staff(current_user)
    eff_status = contest.get_effective_status(now)

    if not is_staff_user:
        if contest.status == ContestStatus.DRAFT:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")
        if eff_status == ContestStatus.UPCOMING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Contest has not started yet. Problems will become visible once the contest is active.",
            )

    stmt_probs = (
        select(ContestProblem)
        .where(ContestProblem.contest_id == contest_id)
        .order_by(ContestProblem.order_index.asc())
    )
    cps = (await db.execute(stmt_probs)).scalars().all()

    return [
        ContestProblemResponse(
            id=cp.id,
            problem_id=cp.problem_id,
            title=cp.problem.title if cp.problem else f"Problem #{cp.problem_id}",
            difficulty=cp.problem.difficulty.value if cp.problem else "medium",
            points=cp.points,
            order_index=cp.order_index,
        )
        for cp in cps
    ]


async def handle_get_contest_problem_detail(
    contest_id: uuid.UUID,
    problem_id: int,
    current_user: User | None,
    db: AsyncSession,
) -> ContestProblemDetailResponse:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    is_staff_user = _is_staff(current_user)
    eff_status = contest.get_effective_status(now)

    if not is_staff_user:
        if contest.status == ContestStatus.DRAFT:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")
        if eff_status == ContestStatus.UPCOMING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Contest has not started yet. Problem details will become visible once the contest begins.",
            )

    stmt_cp = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == problem_id,
    )
    cp = (await db.execute(stmt_cp)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{problem_id} is not part of this contest.",
        )

    prob = cp.problem
    if not prob:
        stmt_prob = select(Problem).where(Problem.id == problem_id)
        prob = (await db.execute(stmt_prob)).scalar_one_or_none()

    if not prob or prob.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Problem not found.",
        )

    # Fetch sample test cases
    stmt_tc = select(TestCaseModel).where(
        TestCaseModel.problem_id == problem_id,
        TestCaseModel.is_sample.is_(True),
    )
    sample_tcs = (await db.execute(stmt_tc)).scalars().all()
    samples = [tc.to_dict() for tc in sample_tcs]

    if not samples:
        stmt_common = select(CommonProblemTemplate).where(
            CommonProblemTemplate.problem_id == problem_id
        )
        tmpl = (await db.execute(stmt_common)).scalar_one_or_none()
        if tmpl and tmpl.run_test_cases:
            samples = list(tmpl.run_test_cases)

    return ContestProblemDetailResponse(
        id=cp.id,
        problem_id=cp.problem_id,
        title=prob.title,
        difficulty=prob.difficulty.value,
        points=cp.points,
        order_index=cp.order_index,
        description=prob.description,
        time_limit=prob.time_limit,
        memory_limit=prob.memory_limit,
        sample_test_cases=samples,
    )


async def handle_contest_submit(
    contest_id: uuid.UUID,
    payload: ContestSubmitRequest,
    current_user: User,
    db: AsyncSession,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    is_staff_user = _is_staff(current_user)
    eff_status = contest.get_effective_status(now)

    # Boundary enforcement
    if not is_staff_user:
        if eff_status == ContestStatus.UPCOMING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contest has not started yet. Submissions are rejected.",
            )
        if eff_status == ContestStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contest has ended. Submissions are closed.",
            )
        if eff_status == ContestStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contest was cancelled.",
            )

        # Check registration
        stmt_part = select(ContestParticipant).where(
            ContestParticipant.contest_id == contest_id,
            ContestParticipant.user_id == current_user.id,
        )
        participant = (await db.execute(stmt_part)).scalar_one_or_none()
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must register for this contest before submitting code.",
            )

    # Verify problem belongs to contest
    stmt_cp = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    )
    cp = (await db.execute(stmt_cp)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Problem #{payload.problem_id} is not assigned to this contest.",
        )

    # Build SubmitRequest with contest_id
    submit_req = SubmitRequest(
        problem_id=payload.problem_id,
        user_code=payload.user_code,
        language=payload.language,
        time_limit=payload.time_limit,
        contest_id=contest_id,
    )

    result = await handle_submit_code_request(
        submission=submit_req,
        current_user=current_user,
        db=db,
    )

    logger.info(
        "User '{}' submitted to contest #{} problem #{}",
        current_user.username,
        contest_id,
        payload.problem_id,
    )
    return result


async def handle_contest_run(
    contest_id: uuid.UUID,
    payload: ContestRunRequest,
    current_user: User | None,
    db: AsyncSession,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    is_staff_user = _is_staff(current_user)
    eff_status = contest.get_effective_status(now)

    if not is_staff_user and eff_status == ContestStatus.UPCOMING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contest has not started yet.",
        )

    # Verify problem belongs to contest
    stmt_cp = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    )
    cp = (await db.execute(stmt_cp)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Problem #{payload.problem_id} is not assigned to this contest.",
        )

    run_req = RunRequest(
        problem_id=payload.problem_id,
        user_code=payload.user_code,
        language=payload.language,
        test_cases=payload.test_cases,
        time_limit=payload.time_limit,
        contest_id=contest_id,
    )

    return await handle_run_code_request(
        submission=run_req,
        current_user=current_user,
        db=db,
    )


async def handle_get_contest_leaderboard(
    contest_id: uuid.UUID,
    current_user: User | None,
    skip: int,
    limit: int,
    db: AsyncSession,
) -> ContestLeaderboardResponse:
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contest not found.",
        )

    now = datetime.now(UTC)
    eff_status = contest.get_effective_status(now)
    if contest.status == ContestStatus.DRAFT and not _is_staff(current_user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    total, entries, winner = await get_contest_leaderboard_data(
        contest_id=contest_id,
        db=db,
        skip=skip,
        limit=limit,
    )

    my_rank_entry = None
    if current_user:
        my_rank_entry = await get_user_contest_rank_data(
            contest_id=contest_id,
            user_id=current_user.id,
            db=db,
        )

    return ContestLeaderboardResponse(
        contest_id=contest.id,
        contest_title=contest.title,
        status=eff_status.value,
        total_participants=total,
        winner=winner,
        leaderboard=entries,
        my_rank=my_rank_entry,
    )


async def handle_get_contest_my_rank(
    contest_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> dict[str, Any]:
    rank_data = await get_user_contest_rank_data(
        contest_id=contest_id,
        user_id=current_user.id,
        db=db,
    )
    if not rank_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not registered in this contest.",
        )
    return rank_data


async def handle_get_contest_participants(
    contest_id: uuid.UUID,
    skip: int,
    limit: int,
    db: AsyncSession,
) -> list[ContestParticipantResponse]:
    stmt = (
        select(ContestParticipant, User)
        .join(User, ContestParticipant.user_id == User.id)
        .where(ContestParticipant.contest_id == contest_id)
        .order_by(ContestParticipant.registered_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    return [
        ContestParticipantResponse(
            id=cp.id,
            user_id=cp.user_id,
            username=u.username,
            name=u.name,
            registered_at=cp.registered_at,
            score=cp.score,
            problems_solved=cp.problems_solved,
            penalty_seconds=cp.penalty_seconds,
            rank=cp.rank,
        )
        for cp, u in rows
    ]


async def handle_get_contest_submissions(
    contest_id: uuid.UUID,
    skip: int,
    limit: int,
    user_id: uuid.UUID | None,
    problem_id: int | None,
    db: AsyncSession,
) -> ContestSubmissionListResponse:
    stmt = (
        select(Submission, User.username)
        .outerjoin(User, Submission.user_id == User.id)
        .where(Submission.contest_id == contest_id)
    )

    if user_id is not None:
        stmt = stmt.where(Submission.user_id == user_id)
    if problem_id is not None:
        stmt = stmt.where(Submission.problem_id == problem_id)

    count_stmt = select(func.count(Submission.id)).where(Submission.contest_id == contest_id)
    if user_id is not None:
        count_stmt = count_stmt.where(Submission.user_id == user_id)
    if problem_id is not None:
        count_stmt = count_stmt.where(Submission.problem_id == problem_id)

    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Submission.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(stmt)).all()

    submissions = [
        ContestSubmissionResponse(
            id=sub.id,
            user_id=sub.user_id,
            username=username,
            problem_id=sub.problem_id,
            problem_name=sub.problem_name,
            language=sub.language.value if hasattr(sub.language, "value") else str(sub.language),
            status=sub.status.value if hasattr(sub.status, "value") else str(sub.status),
            score=sub.score,
            max_score=sub.max_score,
            tests_passed=sub.tests_passed,
            total_tests=sub.total_tests,
            execution_time=sub.execution_time,
            created_at=sub.created_at,
        )
        for sub, username in rows
    ]

    return ContestSubmissionListResponse(
        total=total,
        skip=skip,
        limit=limit,
        submissions=submissions,
    )


async def handle_get_my_contest_submissions(
    contest_id: uuid.UUID,
    current_user: User,
    skip: int,
    limit: int,
    problem_id: int | None,
    db: AsyncSession,
) -> ContestSubmissionListResponse:
    return await handle_get_contest_submissions(
        contest_id=contest_id,
        skip=skip,
        limit=limit,
        user_id=current_user.id,
        problem_id=problem_id,
        db=db,
    )
