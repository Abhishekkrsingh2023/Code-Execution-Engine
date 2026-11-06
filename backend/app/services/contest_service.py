import uuid
from datetime import datetime
from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contest import Contest, ContestParticipant, ContestProblem, ContestStatus
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User


def get_effective_contest_status(contest: Contest, now: datetime | None = None) -> ContestStatus:
    """Determines real-time contest status taking into account start and end timestamps."""
    return contest.get_effective_status(now)


async def sync_contest_status(
    contest: Contest, db: AsyncSession, now: datetime | None = None
) -> ContestStatus:
    """Evaluates and persists the effective status to the database if it has transitioned."""
    effective = contest.get_effective_status(now)
    if contest.status not in (ContestStatus.DRAFT, ContestStatus.CANCELLED):
        if contest.status != effective:
            contest.status = effective
            await db.commit()
            await db.refresh(contest)
            logger.info("Contest #{} status transitioned to {}", contest.id, effective.value)
    return effective


async def recalculate_contest_participant_stats(
    contest_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[float, int, int]:
    """Calculates and updates a participant's score, problems solved, and penalty seconds in a contest.

    Scoring and Tie-Breaking Rules:
    1. For each assigned contest problem, evaluate all submissions made by this user in this contest.
    2. Submissions must fall between contest start_time and end_time.
    3. If solved (ACCEPTED):
       - User receives full problem points.
       - Time taken = seconds from contest start_time to first accepted submission.
       - Wrong submissions before the first AC add penalty time (penalty_minutes * 60 seconds each).
    4. If not solved:
       - Best partial score ratio is awarded (if any), but wrong attempts do NOT assess penalty time.
    5. Returns (total_score, problems_solved, total_penalty_seconds).
    """
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

    # Fetch assigned problems and their points
    stmt_probs = select(ContestProblem).where(ContestProblem.contest_id == contest_id)
    contest_problems = (await db.execute(stmt_probs)).scalars().all()
    problem_points_map = {cp.problem_id: cp.points for cp in contest_problems}

    # Fetch submissions for this contest by this user within contest time window
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
    submissions = (await db.execute(stmt_subs)).scalars().all()

    # Group submissions by problem_id
    problem_subs: dict[int, list[Submission]] = {}
    for sub in submissions:
        if sub.problem_id is not None:
            problem_subs.setdefault(sub.problem_id, []).append(sub)

    total_score = 0.0
    problems_solved = 0
    total_penalty_seconds = 0
    penalty_per_wrong = contest.penalty_minutes * 60

    for prob_id, allocated_points in problem_points_map.items():
        subs = problem_subs.get(prob_id, [])
        is_solved = False
        wrong_count_before_ac = 0
        ac_submission: Submission | None = None
        best_partial_score = 0.0

        for s in subs:
            if s.status == SubmissionStatus.ACCEPTED:
                is_solved = True
                ac_submission = s
                break
            else:
                wrong_count_before_ac += 1
                if s.max_score > 0 and s.score > 0:
                    ratio = min(1.0, s.score / s.max_score)
                    best_partial_score = max(best_partial_score, ratio * allocated_points)

        if is_solved and ac_submission is not None:
            problems_solved += 1
            total_score += allocated_points
            time_to_solve = max(
                0, int((ac_submission.created_at - contest.start_time).total_seconds())
            )
            prob_penalty = time_to_solve + (wrong_count_before_ac * penalty_per_wrong)
            total_penalty_seconds += prob_penalty
        else:
            total_score += best_partial_score

    total_score = round(total_score, 2)
    participant.score = total_score
    participant.problems_solved = problems_solved
    participant.penalty_seconds = total_penalty_seconds

    await db.commit()
    await db.refresh(participant)

    logger.info(
        "Updated contest participant #{} (contest={}): score={}, solved={}, penalty={}s",
        user_id,
        contest_id,
        total_score,
        problems_solved,
        total_penalty_seconds,
    )
    return total_score, problems_solved, total_penalty_seconds


async def get_contest_leaderboard_data(
    contest_id: uuid.UUID,
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[dict[str, Any]], dict[str, Any] | None]:
    """Retrieves paginated leaderboard rankings and winner determination for a contest.

    Ranking Criteria:
    1. Total score (descending)
    2. Problems solved (descending)
    3. Penalty seconds (ascending)
    4. Registration timestamp (ascending)
    """
    stmt_contest = select(Contest).where(Contest.id == contest_id)
    contest = (await db.execute(stmt_contest)).scalar_one_or_none()
    if not contest:
        return 0, [], None

    # Fetch all participants ordered by tie-breaking criteria
    stmt_parts = (
        select(ContestParticipant, User.username)
        .join(User, ContestParticipant.user_id == User.id)
        .where(ContestParticipant.contest_id == contest_id)
        .order_by(
            ContestParticipant.score.desc(),
            ContestParticipant.problems_solved.desc(),
            ContestParticipant.penalty_seconds.asc(),
            ContestParticipant.registered_at.asc(),
        )
    )
    results = (await db.execute(stmt_parts)).all()
    total_participants = len(results)

    if total_participants == 0:
        return 0, [], None

    # Fetch assigned problems
    stmt_probs = select(ContestProblem).where(ContestProblem.contest_id == contest_id)
    contest_problems = (await db.execute(stmt_probs)).scalars().all()
    problem_points_map = {cp.problem_id: cp.points for cp in contest_problems}

    # Fetch all contest submissions to build per-problem breakdown
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

    # User -> problem_id -> list of submissions
    user_problem_subs: dict[uuid.UUID, dict[int, list[Submission]]] = {}
    for sub in all_subs:
        if sub.user_id and sub.problem_id:
            user_problem_subs.setdefault(sub.user_id, {}).setdefault(sub.problem_id, []).append(sub)

    penalty_per_wrong = contest.penalty_minutes * 60

    all_entries: list[dict[str, Any]] = []
    for rank_idx, (part, username) in enumerate(results, start=1):
        user_subs_by_prob = user_problem_subs.get(part.user_id, {})
        problem_breakdown: dict[str, Any] = {}

        for prob_id, points in problem_points_map.items():
            subs = user_subs_by_prob.get(prob_id, [])
            is_solved = False
            wrong_count = 0
            solved_time_seconds: int | None = None
            prob_score = 0.0

            for s in subs:
                if s.status == SubmissionStatus.ACCEPTED:
                    is_solved = True
                    prob_score = points
                    solved_time_seconds = max(
                        0, int((s.created_at - contest.start_time).total_seconds())
                    )
                    break
                else:
                    wrong_count += 1
                    if s.max_score > 0 and s.score > 0:
                        prob_score = max(prob_score, (s.score / s.max_score) * points)

            problem_breakdown[str(prob_id)] = {
                "score": round(prob_score, 2),
                "is_solved": is_solved,
                "attempts": len(subs),
                "solved_time_seconds": solved_time_seconds,
                "penalty_seconds": (
                    (solved_time_seconds or 0) + (wrong_count * penalty_per_wrong)
                    if is_solved
                    else 0
                ),
            }

        entry = {
            "rank": rank_idx,
            "user_id": str(part.user_id),
            "username": username,
            "score": part.score,
            "problems_solved": part.problems_solved,
            "penalty_seconds": part.penalty_seconds,
            "problem_scores": problem_breakdown,
        }
        all_entries.append(entry)

    # Winner determination:
    # 1st rank participant if they have at least solved 1 problem or have score > 0
    winner = None
    if all_entries:
        top_entry = all_entries[0]
        if top_entry["score"] > 0 or top_entry["problems_solved"] > 0:
            winner = top_entry

    paginated_entries = all_entries[skip : skip + limit]
    return total_participants, paginated_entries, winner


async def get_user_contest_rank_data(
    contest_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any] | None:
    """Calculates specific rank and statistics for a given user in a contest."""
    _total, leaderboard, _ = await get_contest_leaderboard_data(
        contest_id=contest_id,
        db=db,
        skip=0,
        limit=100000,  # full list to locate user rank accurately
    )
    for entry in leaderboard:
        if entry["user_id"] == str(user_id):
            return entry
    return None
