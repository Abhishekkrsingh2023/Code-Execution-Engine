import uuid
from typing import Any

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.orm import Session

try:
    from worker.database import SessionLocal
    from worker.models import Problem, Submission, SubmissionLanguage, SubmissionStatus, User
except ImportError:
    # pyrefly: ignore[missing-import]
    from database import SessionLocal

    # pyrefly: ignore[missing-import]
    from models import Problem, Submission, SubmissionLanguage, SubmissionStatus, User


def resolve_problem_id(problem_id_val: int | str | None, db: Session) -> int | None:
    """Resolves a problem identifier (numeric ID or title) to an integer Problem.id."""
    if problem_id_val is None:
        return None
    cleaned = str(problem_id_val).strip()
    if not cleaned:
        return None
    if cleaned.isdigit():
        val = int(cleaned)
        stmt = select(Problem.id).where(Problem.id == val, Problem.is_deleted.is_(False))
        found = db.execute(stmt).scalar_one_or_none()
        if found is not None:
            return found

    # Fallback to title matching
    stmt_title = select(Problem.id).where(
        Problem.title.ilike(cleaned), Problem.is_deleted.is_(False)
    )
    return db.execute(stmt_title).scalars().first()


def update_user_leaderboard_score(user_id: uuid.UUID, db: Session) -> tuple[float, int]:
    """Calculates and updates a user's total score and count of problems solved."""
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
    reg_rows = db.execute(stmt_registered).all()

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
    adhoc_rows = db.execute(stmt_adhoc).all()

    for row in adhoc_rows:
        b_score = float(row.best_score or 0.0)
        m_score = float(row.max_score or 0.0)
        total_score += b_score
        if row.is_accepted or (m_score > 0 and b_score >= m_score):
            problems_solved += 1

    total_score = round(total_score, 2)

    # 3. Update the user row
    user_stmt = select(User).where(User.id == user_id)
    user = db.execute(user_stmt).scalar_one_or_none()
    if user:
        user.total_score = total_score
        user.problems_solved = problems_solved
        db.commit()
        db.refresh(user)
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


def record_submission_completion(
    submission_id: str | uuid.UUID,
    result_data: dict[str, Any],
    db: Session | None = None,
) -> dict[str, Any]:
    """Records judged execution results for a submission and updates user leaderboard stats."""
    if isinstance(submission_id, str):
        try:
            sub_uuid = uuid.UUID(submission_id)
        except ValueError:
            logger.warning("Invalid UUID format for submission completion: {}", submission_id)
            return {}
    else:
        sub_uuid = submission_id

    if db is not None:
        return _record_submission_in_session(sub_uuid, result_data, db)

    with SessionLocal() as session:
        return _record_submission_in_session(sub_uuid, result_data, session)


def _record_submission_in_session(
    sub_uuid: uuid.UUID,
    result_data: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    stmt = select(Submission).where(Submission.id == sub_uuid)
    submission = db.execute(stmt).scalar_one_or_none()

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
        # If Submission record wasn't created at enqueue time, create it now if user_id is provided
        user_id_str = result_data.get("user_id")
        problem_id_val = None
        if result_data.get("problem_id"):
            problem_id_val = resolve_problem_id(str(result_data["problem_id"]), db)

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

    db.commit()
    db.refresh(submission)

    updated_score = None
    updated_solved = None
    if user_id:
        updated_score, updated_solved = update_user_leaderboard_score(user_id, db)

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
