import uuid
from typing import Any

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models.problem import Problem
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.user import User, UserRole, UserStatus


async def resolve_problem_id(problem_id_val: int | str | None, db: AsyncSession) -> int | None:
    """Resolves a problem identifier (numeric ID or title) to an integer Problem.id."""
    if problem_id_val is None:
        return None
    cleaned = str(problem_id_val).strip()
    if not cleaned:
        return None
    if cleaned.isdigit():
        val = int(cleaned)
        stmt = select(Problem.id).where(Problem.id == val, Problem.is_deleted.is_(False))
        found = (await db.execute(stmt)).scalar_one_or_none()
        if found is not None:
            return found

    # Fallback to title matching
    stmt_title = select(Problem.id).where(
        Problem.title.ilike(cleaned), Problem.is_deleted.is_(False)
    )
    return (await db.execute(stmt_title)).scalars().first()


async def update_user_leaderboard_score(user_id: uuid.UUID, db: AsyncSession) -> tuple[float, int]:
    """Calculates and updates a user's total score and count of problems solved.

    Scoring Rule:
    - For each problem the user has submitted to, their best (maximum) score achieved is counted.
    - This prevents score inflation from repeating identical submissions on the same problem.
    - If a submission solves an ad-hoc problem (without a registered Problem.id), it groups by problem_name.
    - A problem is marked 'solved' when max_score > 0 and best_score >= max_score, or status is ACCEPTED.
    """
    # 1. Registered problems
    stmt_registered = (
        select(
            Submission.problem_id,
            func.max(Submission.score).label("best_score"),
            func.max(Submission.max_score).label("max_score"),
            func.bool_or(Submission.status == SubmissionStatus.ACCEPTED).label("is_accepted"),
        )
        .where(
            Submission.user_id == user_id,
            Submission.problem_id.is_not(None),
        )
        .group_by(Submission.problem_id)
    )
    reg_rows = (await db.execute(stmt_registered)).all()

    total_score = 0.0
    problems_solved = 0

    for row in reg_rows:
        b_score = float(row.best_score or 0.0)
        m_score = float(row.max_score or 0.0)
        total_score += b_score
        if row.is_accepted or (m_score > 0 and b_score >= m_score):
            problems_solved += 1

    # 2. Ad-hoc submissions (unregistered problems grouped by problem_name)
    stmt_adhoc = (
        select(
            Submission.problem_name,
            func.max(Submission.score).label("best_score"),
            func.max(Submission.max_score).label("max_score"),
            func.bool_or(Submission.status == SubmissionStatus.ACCEPTED).label("is_accepted"),
        )
        .where(
            Submission.user_id == user_id,
            Submission.problem_id.is_(None),
            Submission.problem_name.is_not(None),
        )
        .group_by(Submission.problem_name)
    )
    adhoc_rows = (await db.execute(stmt_adhoc)).all()

    for row in adhoc_rows:
        b_score = float(row.best_score or 0.0)
        m_score = float(row.max_score or 0.0)
        total_score += b_score
        if row.is_accepted or (m_score > 0 and b_score >= m_score):
            problems_solved += 1

    total_score = round(total_score, 2)

    # 3. Update the user row
    user_stmt = select(User).where(User.id == user_id)
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if user:
        user.total_score = total_score
        user.problems_solved = problems_solved
        await db.commit()
        await db.refresh(user)
        logger.info(
            "Updated user '{}' leaderboard stats: total_score={}, problems_solved={}",
            user.username,
            total_score,
            problems_solved,
        )
        return user.total_score, user.problems_solved

    return total_score, problems_solved


def map_job_status_to_submission_status(
    job_status: str, tests_passed: int, total_tests: int
) -> SubmissionStatus:
    """Maps worker verdict/status strings to SubmissionStatus enum."""
    s = (job_status or "").lower()
    if s in ("completed", "passed"):
        if total_tests > 0 and tests_passed == total_tests:
            return SubmissionStatus.ACCEPTED
        return SubmissionStatus.WRONG_ANSWER
    elif s == "tle":
        return SubmissionStatus.TIME_LIMIT_EXCEEDED
    elif s in ("compilation_error", "compile_error"):
        return SubmissionStatus.COMPILATION_ERROR
    elif s in ("runtime_error",):
        return SubmissionStatus.RUNTIME_ERROR
    elif s == "failed":
        if tests_passed < total_tests and total_tests > 0:
            return SubmissionStatus.WRONG_ANSWER
        return SubmissionStatus.INTERNAL_ERROR
    return (
        SubmissionStatus.ACCEPTED if tests_passed == total_tests else SubmissionStatus.WRONG_ANSWER
    )


async def record_submission_completion(
    submission_id: str | uuid.UUID,
    result_data: dict[str, Any],
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """Records the judged execution results for a submission and updates user leaderboard stats."""
    if isinstance(submission_id, str):
        try:
            sub_uuid = uuid.UUID(submission_id)
        except ValueError:
            logger.warning("Invalid UUID format for submission completion: {}", submission_id)
            return {}
    else:
        sub_uuid = submission_id

    if db is not None:
        return await _record_submission_in_session(sub_uuid, result_data, db)

    async with SessionLocal() as session:
        return await _record_submission_in_session(sub_uuid, result_data, session)


async def _record_submission_in_session(
    sub_uuid: uuid.UUID,
    result_data: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    stmt = select(Submission).where(Submission.id == sub_uuid)
    submission = (await db.execute(stmt)).scalar_one_or_none()

    score = float(result_data.get("score", 0.0) or 0.0)
    max_score = float(result_data.get("max_score", 0.0) or 0.0)
    tests_passed = int(result_data.get("tests_passed", 0) or 0)
    total_tests = int(result_data.get("total_tests", 0) or 0)
    time_taken = float(result_data.get("time_taken", 0.0) or 0.0)
    raw_status = str(result_data.get("status", "completed"))

    verdict = map_job_status_to_submission_status(raw_status, tests_passed, total_tests)

    user_id = None
    if submission:
        submission.status = verdict
        submission.score = score
        submission.max_score = max_score
        submission.tests_passed = tests_passed
        submission.total_tests = total_tests
        submission.execution_time = time_taken
        user_id = submission.user_id
    else:
        # If Submission record wasn't created at enqueue time (e.g. ad-hoc run), create it now if user_id is provided
        user_id_str = result_data.get("user_id")
        problem_id_val = None
        if result_data.get("problem_id"):
            problem_id_val = await resolve_problem_id(str(result_data["problem_id"]), db)

        if user_id_str:
            try:
                user_id = uuid.UUID(str(user_id_str))
            except ValueError:
                user_id = None

        lang_str = str(result_data.get("language", "python")).lower()
        try:
            sub_lang = SubmissionLanguage(lang_str)
        except ValueError:
            sub_lang = SubmissionLanguage.PYTHON

        submission = Submission(
            id=sub_uuid,
            user_id=user_id,
            problem_id=problem_id_val,
            problem_name=str(result_data.get("problem_name", "Submission")),
            language=sub_lang,
            source_code=str(result_data.get("user_code", "")),
            status=verdict,
            score=score,
            max_score=max_score,
            tests_passed=tests_passed,
            total_tests=total_tests,
            execution_time=time_taken,
        )
        db.add(submission)

    await db.commit()
    await db.refresh(submission)

    updated_score = None
    updated_solved = None
    if user_id:
        updated_score, updated_solved = await update_user_leaderboard_score(user_id, db)

    return {
        "submission_id": str(sub_uuid),
        "status": verdict.value,
        "score": score,
        "max_score": max_score,
        "tests_passed": tests_passed,
        "total_tests": total_tests,
        "user_total_score": updated_score,
        "user_problems_solved": updated_solved,
    }


async def get_leaderboard_data(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[dict[str, Any]]]:
    """Retrieves paginated leaderboard rankings for regular users sorted by total_score desc, problems_solved desc, created_at asc."""
    count_stmt = select(func.count(User.id)).where(
        User.status == UserStatus.ACTIVE,
        User.role == UserRole.USER,
    )
    query_stmt = select(User).where(
        User.status == UserStatus.ACTIVE,
        User.role == UserRole.USER,
    )

    total = (await db.execute(count_stmt)).scalar_one()

    query_stmt = (
        query_stmt.order_by(
            User.total_score.desc(),
            User.problems_solved.desc(),
            User.created_at.asc(),
        )
        .offset(skip)
        .limit(limit)
    )

    users = (await db.execute(query_stmt)).scalars().all()

    if not users:
        return total, []

    user_ids = [u.id for u in users]

    # Batch fetch submission counts for all leaderboard users in one query (avoids N+1)
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

    leaderboard: list[dict[str, Any]] = [
        {
            "rank": skip + idx + 1,
            "user_id": str(u.id),
            "username": u.username,
            "total_score": u.total_score,
            "problems_solved": u.problems_solved,
            "submissions_count": sub_count_map.get(u.id, 0),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for idx, u in enumerate(users)
    ]

    return total, leaderboard


async def get_user_rank_data(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any] | None:
    """Calculates the specific rank and stats for a given regular user."""
    stmt = select(User).where(
        User.id == user_id,
        User.status == UserStatus.ACTIVE,
        User.role == UserRole.USER,
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        return None

    # Count how many users with role=USER have higher score or tiebreakers
    # (total_score > my_score) OR
    # (total_score == my_score AND problems_solved > my_solved) OR
    # (total_score == my_score AND problems_solved == my_solved AND created_at < my_created_at)
    higher_count_stmt = select(func.count(User.id)).where(
        User.status == UserStatus.ACTIVE,
        User.role == UserRole.USER,
        (User.total_score > user.total_score)
        | ((User.total_score == user.total_score) & (User.problems_solved > user.problems_solved))
        | (
            (User.total_score == user.total_score)
            & (User.problems_solved == user.problems_solved)
            & (User.created_at < user.created_at)
        ),
    )
    higher_count = (await db.execute(higher_count_stmt)).scalar_one()
    rank = higher_count + 1

    sub_count_stmt = select(func.count(Submission.id)).where(Submission.user_id == user.id)
    sub_count = (await db.execute(sub_count_stmt)).scalar_one()

    return {
        "rank": rank,
        "user_id": str(user.id),
        "username": user.username,
        "total_score": user.total_score,
        "problems_solved": user.problems_solved,
        "submissions_count": sub_count,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
