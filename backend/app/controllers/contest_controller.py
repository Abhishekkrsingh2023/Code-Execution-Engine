from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, Request, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.code_controller import (
    handle_run_code_request,
    handle_submit_code_request,
    load_problem_test_cases,
)
from app.models.audit_log import AuditLogAction, AuditLogStatus
from app.models.contest import Contest, ContestParticipant, ContestProblem, ContestStatus
from app.models.problem import Problem
from app.models.user import User, UserRole
from app.schemas.contest import (
    ContestCreateRequest,
    ContestLeaderboardEntry,
    ContestLeaderboardResponse,
    ContestListResponse,
    ContestParticipantResponse,
    ContestProblemDetailResponse,
    ContestProblemResponse,
    ContestResponse,
    ContestRunRequest,
    ContestSubmitRequest,
    ContestUpdateRequest,
)
from app.schemas.submission import Language, RunRequest, SubmitRequest
from app.schemas.user import MessageResponse
from app.services.contest_service import (
    get_contest_leaderboard_data,
    get_user_contest_rank_data,
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
                position=cp.position,
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
        penalty_minutes=contest.penalty_minutes,
        participant_count=p_count,
        problem_count=len(contest.contest_problems) if contest.contest_problems else 0,
        is_registered=is_registered,
        created_by=contest.created_by,
        created_at=contest.created_at,
        server_time=now,
        problems=problem_responses,
    )


async def handle_create_contest(
    payload: ContestCreateRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestResponse:
    """Creates a new contest atomically with its ordered problem list."""
    now = datetime.now(UTC)

    # Validate problem IDs exist
    stmt_probs = select(Problem).where(
        Problem.id.in_(payload.problem_ids), Problem.is_deleted.is_(False)
    )
    found_problems = (await db.execute(stmt_probs)).scalars().all()
    found_map = {p.id: p for p in found_problems}

    for pid in payload.problem_ids:
        if pid not in found_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Problem with ID {pid} does not exist or has been deleted.",
            )

    contest = Contest(
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        penalty_minutes=payload.penalty_minutes,
        created_by=current_user.id,
    )
    db.add(contest)
    await db.flush()

    for idx, pid in enumerate(payload.problem_ids, start=1):
        cp = ContestProblem(
            contest_id=contest.id,
            problem_id=pid,
            position=idx,
            points=100.0,
        )
        db.add(cp)

    await db.commit()
    await db.refresh(contest)

    await log_audit_event(
        db=db,
        action=AuditLogAction.CONTEST_CREATE.value,
        actor_id=current_user.id,
        actor_username=str(current_user.username),
        actor_role=current_user.role.value if current_user.role else "user",
        target_type="contest",
        target_id=str(contest.id),
        status=AuditLogStatus.SUCCESS.value,
        details={
            "title": contest.title,
            "problem_ids": payload.problem_ids,
            "start_time": contest.start_time.isoformat(),
            "end_time": contest.end_time.isoformat(),
        },
        ip_address=request.client.host if request.client else None,
    )

    logger.info(
        "Created contest #{} '{}' with {} problems",
        contest.id,
        contest.title,
        len(payload.problem_ids),
    )
    return _build_contest_response(contest, now=now, include_problems=True)


async def handle_update_contest(
    contest_id: int,
    payload: ContestUpdateRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestResponse:
    """Updates contest parameters respecting the Rule 7 edit-after-start matrix."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    current_status = contest.get_effective_status(now)

    if current_status == ContestStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contest has ended and cannot be modified.",
        )

    if current_status == ContestStatus.LIVE:
        # Rule 7: Once live, ONLY title and description can be modified. Problem list, order, start_time AND end_time are locked.
        if (
            payload.start_time is not None
            or payload.end_time is not None
            or payload.penalty_minutes is not None
            or payload.problem_ids is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contest is currently live. Only title and description can be edited.",
            )

    # Apply title and description
    if payload.title is not None:
        contest.title = payload.title
    if payload.description is not None:
        contest.description = payload.description

    # If upcoming, apply other updates
    if current_status == ContestStatus.UPCOMING:
        if payload.start_time is not None:
            contest.start_time = payload.start_time
        if payload.end_time is not None:
            contest.end_time = payload.end_time
        if payload.penalty_minutes is not None:
            contest.penalty_minutes = payload.penalty_minutes

        if payload.problem_ids is not None:
            # Validate problems
            stmt_probs = select(Problem).where(
                Problem.id.in_(payload.problem_ids), Problem.is_deleted.is_(False)
            )
            found_problems = (await db.execute(stmt_probs)).scalars().all()
            found_map = {p.id: p for p in found_problems}
            for pid in payload.problem_ids:
                if pid not in found_map:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Problem with ID {pid} does not exist or has been deleted.",
                    )

            # Clear existing problems and re-assign
            for cp in list(contest.contest_problems):
                await db.delete(cp)
            await db.flush()

            for idx, pid in enumerate(payload.problem_ids, start=1):
                cp = ContestProblem(
                    contest_id=contest.id,
                    problem_id=pid,
                    position=idx,
                    points=100.0,
                )
                db.add(cp)

    await db.commit()
    await db.refresh(contest)

    await log_audit_event(
        db=db,
        action=AuditLogAction.CONTEST_UPDATE.value,
        actor_id=current_user.id,
        actor_username=str(current_user.username),
        actor_role=current_user.role.value if current_user.role else "user",
        target_type="contest",
        target_id=str(contest.id),
        status=AuditLogStatus.SUCCESS.value,
        details={"title": contest.title},
        ip_address=request.client.host if request.client else None,
    )

    return _build_contest_response(contest, now=now, include_problems=True)


async def handle_delete_contest(
    contest_id: int,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> MessageResponse:
    """Deletes an upcoming contest. Rule 7: Delete is allowed ONLY for upcoming contests."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    current_status = contest.get_effective_status(now)
    if current_status != ContestStatus.UPCOMING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete contest with status '{current_status.value}'. Delete is only permitted for upcoming contests.",
        )

    await db.delete(contest)
    await db.commit()

    await log_audit_event(
        db=db,
        action=AuditLogAction.CONTEST_DELETE.value,
        actor_id=current_user.id,
        actor_username=str(current_user.username),
        actor_role=current_user.role.value if current_user.role else "user",
        target_type="contest",
        target_id=str(contest_id),
        status=AuditLogStatus.SUCCESS.value,
        details={"title": contest.title},
        ip_address=request.client.host if request.client else None,
    )

    return MessageResponse(message=f"Contest #{contest_id} deleted successfully.")


async def handle_get_contest(
    contest_id: int,
    current_user: User | None,
    db: AsyncSession,
) -> ContestResponse:
    """Retrieves a single contest. Hides problems before start_time for non-staff."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    is_registered = False
    if current_user:
        stmt_part = select(ContestParticipant).where(
            ContestParticipant.contest_id == contest_id,
            ContestParticipant.user_id == current_user.id,
        )
        is_registered = (await db.execute(stmt_part)).scalar_one_or_none() is not None

    staff = _is_staff(current_user)
    effective_status = contest.get_effective_status(now)
    # Hide problems before start_time for non-staff
    include_problems = staff or (effective_status in (ContestStatus.LIVE, ContestStatus.ENDED))

    return _build_contest_response(
        contest,
        now=now,
        is_registered=is_registered,
        include_problems=include_problems,
    )


async def handle_list_contests(
    skip: int,
    limit: int,
    contest_status: str | None,
    search: str | None,
    current_user: User | None,
    db: AsyncSession,
) -> ContestListResponse:
    """Lists contests filtered by derived status (upcoming, live, ended) and search term."""
    now = datetime.now(UTC)
    query_stmt = select(Contest).order_by(Contest.start_time.desc())
    count_stmt = select(func.count(Contest.id))

    if contest_status:
        s = contest_status.lower()
        if s == "upcoming":
            query_stmt = query_stmt.where(Contest.start_time > now)
            count_stmt = count_stmt.where(Contest.start_time > now)
        elif s == "live":
            query_stmt = query_stmt.where(Contest.start_time <= now, Contest.end_time >= now)
            count_stmt = count_stmt.where(Contest.start_time <= now, Contest.end_time >= now)
        elif s == "ended":
            query_stmt = query_stmt.where(Contest.end_time < now)
            count_stmt = count_stmt.where(Contest.end_time < now)

    if search:
        search_filter = Contest.title.ilike(f"%{search}%") | Contest.description.ilike(
            f"%{search}%"
        )
        query_stmt = query_stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = (await db.execute(count_stmt)).scalar_one()
    contests = (await db.execute(query_stmt.offset(skip).limit(limit))).scalars().all()

    user_registered_contest_ids: set[int] = set()
    if current_user:
        stmt_user_parts = select(ContestParticipant.contest_id).where(
            ContestParticipant.user_id == current_user.id
        )
        user_registered_contest_ids = set((await db.execute(stmt_user_parts)).scalars().all())

    staff = _is_staff(current_user)
    contest_responses = [
        _build_contest_response(
            c,
            now=now,
            is_registered=(c.id in user_registered_contest_ids),
            include_problems=staff
            or (c.get_effective_status(now) in (ContestStatus.LIVE, ContestStatus.ENDED)),
        )
        for c in contests
    ]

    return ContestListResponse(
        total=total,
        skip=skip,
        limit=limit,
        server_time=now,
        contests=contest_responses,
    )


async def handle_register_contest(
    contest_id: int,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> ContestParticipantResponse:
    """Registers an active, verified user for a contest. Rule 4: allowed until end_time."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    if not current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email must be verified before participating in contests.",
        )

    if now > contest.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contest has ended; registration is closed.",
        )

    # Check already registered
    stmt_existing = select(ContestParticipant).where(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == current_user.id,
    )
    existing = (await db.execute(stmt_existing)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already registered for this contest.",
        )

    participant = ContestParticipant(
        contest_id=contest_id,
        user_id=current_user.id,
        registered_at=now,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)

    logger.info("User '{}' registered for contest #{}", current_user.username, contest_id)
    return ContestParticipantResponse(
        id=participant.id,
        contest_id=contest_id,
        user_id=current_user.id,
        username=str(current_user.username),
        name=current_user.name,
        registered_at=participant.registered_at,
        score=participant.score,
        problems_solved=participant.problems_solved,
        penalty_seconds=participant.penalty_seconds,
        rank=participant.rank,
    )


async def handle_unregister_contest(
    contest_id: int,
    current_user: User,
    db: AsyncSession,
) -> MessageResponse:
    """Unregisters a participant. Rule 4: unregistration is ONLY allowed before start_time."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    if now >= contest.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unregister once the contest has started.",
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

    return MessageResponse(message=f"Successfully unregistered from contest #{contest_id}.")


async def handle_get_contest_problems(
    contest_id: int,
    current_user: User | None,
    db: AsyncSession,
) -> list[ContestProblemResponse]:
    """Returns contest problems. Enforces Rule 5: 403 Forbidden before start_time for non-staff."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    staff = _is_staff(current_user)
    if not staff and now < contest.start_time:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contest problems and statements are hidden until the contest starts.",
        )

    return [
        ContestProblemResponse(
            id=cp.id,
            problem_id=cp.problem_id,
            title=cp.problem.title if cp.problem else f"Problem #{cp.problem_id}",
            difficulty=cp.problem.difficulty.value if cp.problem else "medium",
            points=cp.points,
            position=cp.position,
        )
        for cp in contest.contest_problems
    ]


async def handle_get_contest_problem_detail(
    contest_id: int,
    problem_id: int,
    current_user: User | None,
    db: AsyncSession,
) -> ContestProblemDetailResponse:
    """Returns detailed problem statement. Rule 5: 403 Forbidden before start_time for non-staff."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    staff = _is_staff(current_user)
    if not staff and now < contest.start_time:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Problem statements are strictly hidden until the contest begins.",
        )

    stmt_cp = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == problem_id,
    )
    cp = (await db.execute(stmt_cp)).scalar_one_or_none()
    if not cp or not cp.problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{problem_id} is not part of contest #{contest_id}.",
        )

    problem = cp.problem
    loaded_tcs, _, _ = await load_problem_test_cases(problem_id, mode="run", db=db)
    sample_cases = [
        {
            "id": tc.id,
            "input": tc.input,
            "input_data": tc.input,
            "expected_output": tc.expected_output,
            "weight": tc.weight,
        }
        for tc in loaded_tcs
    ]
    if not sample_cases and problem.test_cases:
        sample_cases = [
            {
                "id": tc.id,
                "input": tc.input,
                "input_data": tc.input,
                "expected_output": tc.expected_output,
                "weight": tc.weight,
            }
            for tc in problem.test_cases
        ]

    return ContestProblemDetailResponse(
        id=cp.id,
        problem_id=cp.problem_id,
        title=problem.title,
        difficulty=problem.difficulty.value,
        points=cp.points,
        position=cp.position,
        description=problem.description,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        sample_test_cases=sample_cases,
    )


async def handle_contest_submit(
    contest_id: int,
    payload: ContestSubmitRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> dict[str, Any]:
    """Submits code to a contest problem during a live contest for a registered user."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    effective_status = contest.get_effective_status(now)
    if effective_status != ContestStatus.LIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Contest submissions are only accepted while the contest is live (current status: '{effective_status.value}').",
        )

    # Check participant registration
    stmt_part = select(ContestParticipant).where(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == current_user.id,
    )
    participant = (await db.execute(stmt_part)).scalar_one_or_none()
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be registered for this contest before submitting solutions.",
        )

    # Check problem belongs to contest
    stmt_cp = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    )
    cp = (await db.execute(stmt_cp)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{payload.problem_id} does not belong to contest #{contest_id}.",
        )

    sub_req = SubmitRequest(
        problem_id=payload.problem_id,
        user_code=payload.user_code,
        language=Language(payload.language),
        time_limit=payload.time_limit,
    )

    submission_obj = await handle_submit_code_request(
        submission=sub_req,
        current_user=current_user,
        db=db,
        contest_id=contest_id,
    )

    return submission_obj


async def handle_contest_run(
    contest_id: int,
    payload: ContestRunRequest,
    current_user: User,
    request: Request,
    db: AsyncSession,
) -> dict[str, Any]:
    """Rule 11: Runs code during a live contest for a registered user."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    effective_status = contest.get_effective_status(now)
    if effective_status != ContestStatus.LIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Test-running code in a contest is only permitted while the contest is live (current status: '{effective_status.value}').",
        )

    # Check participant registration
    stmt_part = select(ContestParticipant).where(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == current_user.id,
    )
    participant = (await db.execute(stmt_part)).scalar_one_or_none()
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be registered for this contest to run test code.",
        )

    # Check problem belongs to contest
    stmt_cp = select(ContestProblem).where(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    )
    cp = (await db.execute(stmt_cp)).scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem #{payload.problem_id} does not belong to contest #{contest_id}.",
        )

    test_cases_to_run = payload.test_cases
    if not test_cases_to_run:
        loaded_tcs, _, _ = await load_problem_test_cases(payload.problem_id, mode="run", db=db)
        test_cases_to_run = loaded_tcs

    run_req = RunRequest(
        problem_id=payload.problem_id,
        user_code=payload.user_code,
        language=Language(payload.language),
        test_cases=test_cases_to_run,
        time_limit=payload.time_limit,
    )

    return await handle_run_code_request(
        submission=run_req,
        current_user=current_user,
        db=db,
        contest_id=contest_id,
    )


async def handle_get_contest_leaderboard(
    contest_id: int,
    current_user: User | None,
    skip: int,
    limit: int,
    db: AsyncSession,
) -> ContestLeaderboardResponse:
    """Retrieves the contest leaderboard computed using ICPC scoring."""
    now = datetime.now(UTC)
    stmt = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt)).scalar_one_or_none()
    if not contest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Contest #{contest_id} not found."
        )

    total, entries_data, winner_data = await get_contest_leaderboard_data(
        contest_id=contest_id,
        db=db,
        skip=skip,
        limit=limit,
    )

    entries = [ContestLeaderboardEntry(**ed) for ed in entries_data]
    winner = ContestLeaderboardEntry(**winner_data) if winner_data else None

    my_rank_entry = None
    if current_user:
        my_rank_data = await get_user_contest_rank_data(contest_id, current_user.id, db)
        if my_rank_data:
            my_rank_entry = ContestLeaderboardEntry(**my_rank_data)

    return ContestLeaderboardResponse(
        contest_id=contest.id,
        contest_title=contest.title,
        status=contest.get_effective_status(now).value,
        total_participants=total,
        server_time=now,
        winner=winner,
        leaderboard=entries,
        my_rank=my_rank_entry,
    )


async def handle_get_contest_my_rank(
    contest_id: int,
    current_user: User,
    db: AsyncSession,
) -> ContestLeaderboardEntry:
    """Retrieves the current user's rank in a contest."""
    my_rank_data = await get_user_contest_rank_data(contest_id, current_user.id, db)
    if not my_rank_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You have no rank data for this contest.",
        )
    return ContestLeaderboardEntry(**my_rank_data)
