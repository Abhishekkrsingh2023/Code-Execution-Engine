import uuid
from datetime import datetime
from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contest import Contest, ContestParticipant, ContestProblem
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User

# Wrong attempt verdicts that incur penalty in ICPC
# Note: COMPILATION_ERROR and INTERNAL_ERROR add nothing per Rule 2
PENALTY_VERDICTS = {
    SubmissionStatus.WRONG_ANSWER,
    SubmissionStatus.TIME_LIMIT_EXCEEDED,
    SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
    SubmissionStatus.RUNTIME_ERROR,
}


def calculate_icpc_participant_score(
    contest_start_time: datetime,
    contest_end_time: datetime,
    penalty_minutes: int,
    problem_ids: list[int],
    user_submissions: list[Submission],
) -> tuple[float, int, int, datetime | None, dict[int, dict[str, Any]]]:
    """Pure function calculating ICPC score, solved count, penalty time, and last AC timestamp.

    Rules strictly followed:
    - Only submissions within [start_time, end_time] count.
    - Submissions evaluated in created_at ascending order.
    - If problem is solved (at least one ACCEPTED verdict):
      - Solved count += 1.
      - Solve time = seconds from contest_start_time to first accepted submission received time (created_at).
      - Wrong attempts before the first AC add (penalty_minutes * 60) seconds each.
      - Compile errors and system errors add 0 penalty.
      - Submissions after the first AC are ignored.
      - Pending submissions don't count until they have a verdict.
    - If problem is NOT solved:
      - Wrong attempts add 0 penalty.
    """
    subs_by_problem: dict[int, list[Submission]] = {}
    for s in user_submissions:
        if s.problem_id is not None and s.problem_id in problem_ids:
            # Submissions must fall inside the contest window
            if contest_start_time <= s.created_at <= contest_end_time:
                subs_by_problem.setdefault(s.problem_id, []).append(s)

    problems_solved = 0
    total_penalty_seconds = 0
    total_score = 0.0
    last_accepted_at: datetime | None = None
    problem_stats: dict[int, dict[str, Any]] = {}

    for prob_id in problem_ids:
        p_subs = subs_by_problem.get(prob_id, [])
        p_subs.sort(key=lambda x: x.created_at)

        is_solved = False
        wrong_count_before_ac = 0
        first_ac_sub: Submission | None = None

        for sub in p_subs:
            # Pending submissions are ignored until they have a verdict
            if sub.status in (
                SubmissionStatus.PENDING,
                SubmissionStatus.QUEUED,
                SubmissionStatus.RUNNING,
            ):
                continue

            if sub.status == SubmissionStatus.ACCEPTED:
                is_solved = True
                first_ac_sub = sub
                break
            elif sub.status in PENALTY_VERDICTS:
                wrong_count_before_ac += 1
            # Note: COMPILATION_ERROR and INTERNAL_ERROR add nothing

        if is_solved and first_ac_sub is not None:
            problems_solved += 1
            total_score += 100.0  # Or 1 solve point
            solve_time = max(0, int((first_ac_sub.created_at - contest_start_time).total_seconds()))
            prob_penalty = solve_time + (wrong_count_before_ac * penalty_minutes * 60)
            total_penalty_seconds += prob_penalty

            if last_accepted_at is None or first_ac_sub.created_at > last_accepted_at:
                last_accepted_at = first_ac_sub.created_at

            problem_stats[prob_id] = {
                "problem_id": prob_id,
                "is_solved": True,
                "score": 100.0,
                "attempts": wrong_count_before_ac + 1,
                "solved_time_seconds": solve_time,
                "penalty_seconds": prob_penalty,
            }
        else:
            # Not solved: wrong attempts do not add penalty
            problem_stats[prob_id] = {
                "problem_id": prob_id,
                "is_solved": False,
                "score": 0.0,
                "attempts": wrong_count_before_ac,
                "solved_time_seconds": None,
                "penalty_seconds": 0,
            }

    return total_score, problems_solved, total_penalty_seconds, last_accepted_at, problem_stats


def rank_icpc_participants(
    participant_data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Assigns ranks according to ICPC rules:
    - Primary sort: problems_solved desc
    - Secondary sort: penalty_seconds asc
    - Tie display sort: last_accepted_at asc (earlier last AC wins), then registered_at asc
    - Equal solved and penalty share the same rank (e.g. 1, 1, 3).
    """

    def sort_key(p: dict[str, Any]) -> tuple[int, int, float, float]:
        solved = p["problems_solved"]
        penalty = p["penalty_seconds"]
        last_ac = p.get("last_accepted_at")
        last_ac_ts = last_ac.timestamp() if isinstance(last_ac, datetime) else float("inf")
        reg_at = p.get("registered_at")
        reg_ts = reg_at.timestamp() if isinstance(reg_at, datetime) else 0.0
        # For sorting: -solved (descending), penalty (ascending), last_ac_ts (ascending), reg_ts (ascending)
        return (-solved, penalty, last_ac_ts, reg_ts)

    sorted_participants = sorted(participant_data, key=sort_key)

    for i, p in enumerate(sorted_participants):
        if i > 0:
            prev = sorted_participants[i - 1]
            if (
                p["problems_solved"] == prev["problems_solved"]
                and p["penalty_seconds"] == prev["penalty_seconds"]
            ):
                p["rank"] = prev["rank"]
            else:
                p["rank"] = i + 1
        else:
            p["rank"] = 1

    return sorted_participants


async def recalculate_contest_participant_stats(
    contest_id: int,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[float, int, int]:
    """Calculates and updates participant stats in database for a contest."""
    stmt_contest = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt_contest)).scalar_one_or_none()
    if not contest:
        return 0.0, 0, 0

    stmt_part = select(ContestParticipant).where(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == user_id,
    )
    participant = (await db.execute(stmt_part)).scalar_one_or_none()
    if not participant:
        return 0.0, 0, 0

    stmt_probs = select(ContestProblem.problem_id).where(ContestProblem.contest_id == contest_id)
    problem_ids = list((await db.execute(stmt_probs)).scalars().all())

    stmt_subs = (
        select(Submission)
        .where(
            Submission.contest_id == contest_id,
            Submission.user_id == user_id,
            Submission.created_at >= contest.start_time,
            Submission.created_at <= contest.end_time,
        )
        .order_by(Submission.created_at.asc())
    )
    submissions = list((await db.execute(stmt_subs)).scalars().all())

    score, solved, penalty, last_ac, _ = calculate_icpc_participant_score(
        contest_start_time=contest.start_time,
        contest_end_time=contest.end_time,
        penalty_minutes=contest.penalty_minutes,
        problem_ids=problem_ids,
        user_submissions=submissions,
    )

    participant.score = score
    participant.problems_solved = solved
    participant.penalty_seconds = penalty
    participant.last_accepted_at = last_ac

    await db.commit()
    await db.refresh(participant)

    logger.info(
        "Updated contest participant #{} (contest={}): solved={}, penalty={}s, last_ac={}",
        user_id,
        contest_id,
        solved,
        penalty,
        last_ac,
    )
    return score, solved, penalty


async def get_contest_leaderboard_data(
    contest_id: int,
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[dict[str, Any]], dict[str, Any] | None]:
    """Retrieves paginated leaderboard rankings and winner determination for a contest."""
    stmt_contest = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt_contest)).scalar_one_or_none()
    if not contest:
        return 0, [], None

    stmt_probs = select(ContestProblem.problem_id).where(ContestProblem.contest_id == contest_id)
    problem_ids = list((await db.execute(stmt_probs)).scalars().all())

    stmt_parts = (
        select(ContestParticipant, User.username)
        .join(User, ContestParticipant.user_id == User.id)
        .where(ContestParticipant.contest_id == contest_id)
    )
    results = (await db.execute(stmt_parts)).all()
    if not results:
        return 0, [], None

    # Fetch all submissions for the contest
    stmt_subs = (
        select(Submission)
        .where(
            Submission.contest_id == contest_id,
            Submission.created_at >= contest.start_time,
            Submission.created_at <= contest.end_time,
        )
        .order_by(Submission.created_at.asc())
    )
    all_subs = (await db.execute(stmt_subs)).scalars().all()
    subs_by_user: dict[uuid.UUID, list[Submission]] = {}
    for s in all_subs:
        if s.user_id is not None:
            subs_by_user.setdefault(s.user_id, []).append(s)

    participant_records: list[dict[str, Any]] = []
    for part, username in results:
        user_subs = subs_by_user.get(part.user_id, [])
        score, solved, penalty, last_ac, p_stats = calculate_icpc_participant_score(
            contest_start_time=contest.start_time,
            contest_end_time=contest.end_time,
            penalty_minutes=contest.penalty_minutes,
            problem_ids=problem_ids,
            user_submissions=user_subs,
        )
        participant_records.append(
            {
                "user_id": str(part.user_id),
                "username": username,
                "score": score,
                "problems_solved": solved,
                "penalty_seconds": penalty,
                "last_accepted_at": last_ac,
                "registered_at": part.registered_at,
                "problem_scores": {str(k): v for k, v in p_stats.items()},
            }
        )

    ranked_records = rank_icpc_participants(participant_records)
    total_count = len(ranked_records)
    winner = (
        ranked_records[0] if total_count > 0 and ranked_records[0]["problems_solved"] > 0 else None
    )
    paginated_leaderboard = ranked_records[skip : skip + limit]

    return total_count, paginated_leaderboard, winner


async def get_user_contest_rank_data(
    contest_id: int,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any] | None:
    """Retrieves rank and per-problem breakdown for a specific user in a contest."""
    _total, leaderboard, _ = await get_contest_leaderboard_data(contest_id, db, skip=0, limit=10000)
    for entry in leaderboard:
        if entry["user_id"] == str(user_id):
            return entry
    return None
