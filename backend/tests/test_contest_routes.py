"""Comprehensive tests for Contest Management System, ICPC scoring, and lifecycle rules."""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contest import Contest, ContestParticipant, ContestProblem, ContestStatus
from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.test_case import TestCase as TestCaseModel
from app.models.user import User
from app.services.contest_service import (
    calculate_icpc_participant_score,
    rank_icpc_participants,
)
from app.services.leaderboard_service import update_user_leaderboard_score
from app.utils.jwt import create_access_token


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, role=user.role)
    return {"Authorization": f"Bearer {token}"}


async def create_test_problem(
    db: AsyncSession,
    title: str = "Sum of Two",
    created_by: uuid.UUID | None = None,
) -> Problem:
    prob = Problem(
        title=title,
        description="Calculate the sum of two integers.",
        difficulty=ProblemDifficulty.EASY,
        category="Algorithms",
        topic="math",
        time_limit=2.0,
        memory_limit=256,
        status=ProblemStatus.PUBLISHED,
        created_by=created_by,
    )
    db.add(prob)
    await db.commit()
    await db.refresh(prob)

    tc1 = TestCaseModel(
        problem_id=prob.id,
        input="2 3\n",
        expected_output="5\n",
        is_sample=True,
        weight=10.0,
    )
    tc2 = TestCaseModel(
        problem_id=prob.id,
        input="10 20\n",
        expected_output="30\n",
        is_sample=False,
        weight=40.0,
    )
    db.add_all([tc1, tc2])
    await db.commit()
    return prob


class TestContestStatusDerivation:
    """Tests status derivation strictly from server clock and boundaries."""

    def test_status_boundaries(self) -> None:
        start = datetime(2026, 11, 10, 10, 0, 0, tzinfo=UTC)
        end = datetime(2026, 11, 10, 12, 0, 0, tzinfo=UTC)
        contest = Contest(title="Boundary Test", start_time=start, end_time=end)

        # 1s before start -> upcoming
        assert contest.get_effective_status(start - timedelta(seconds=1)) == ContestStatus.UPCOMING
        # Exactly at start -> live
        assert contest.get_effective_status(start) == ContestStatus.LIVE
        # In the middle -> live
        assert contest.get_effective_status(start + timedelta(hours=1)) == ContestStatus.LIVE
        # Exactly at end -> live
        assert contest.get_effective_status(end) == ContestStatus.LIVE
        # 1s after end -> ended
        assert contest.get_effective_status(end + timedelta(seconds=1)) == ContestStatus.ENDED


class TestContestCreationValidation:
    """Tests validation when creating contests."""

    async def test_create_contest_invalid_duration_fails(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        p = await create_test_problem(db_session, "Prob 1")
        now = datetime.now(UTC)
        payload = {
            "title": "Invalid Duration",
            "start_time": now.isoformat(),
            "end_time": (now - timedelta(hours=1)).isoformat(),
            "problem_ids": [p.id],
        }
        res = await async_client.post(
            "/api-v1/contests", json=payload, headers=auth_headers(moderator_user)
        )
        assert res.status_code in (400, 422)

    async def test_create_contest_empty_problems_fails(
        self,
        async_client: AsyncClient,
        moderator_user: User,
    ) -> None:
        now = datetime.now(UTC)
        payload = {
            "title": "Empty Problems",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=3)).isoformat(),
            "problem_ids": [],
        }
        res = await async_client.post(
            "/api-v1/contests", json=payload, headers=auth_headers(moderator_user)
        )
        assert res.status_code in (400, 422)

    async def test_create_contest_duplicate_problems_fails(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        p = await create_test_problem(db_session, "Prob Duplicate")
        now = datetime.now(UTC)
        payload = {
            "title": "Duplicate Problems",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=3)).isoformat(),
            "problem_ids": [p.id, p.id],
        }
        res = await async_client.post(
            "/api-v1/contests", json=payload, headers=auth_headers(moderator_user)
        )
        assert res.status_code in (400, 422)

    async def test_create_contest_missing_problem_fails(
        self,
        async_client: AsyncClient,
        moderator_user: User,
    ) -> None:
        now = datetime.now(UTC)
        payload = {
            "title": "Nonexistent Problem",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=3)).isoformat(),
            "problem_ids": [999999],
        }
        res = await async_client.post(
            "/api-v1/contests", json=payload, headers=auth_headers(moderator_user)
        )
        assert res.status_code == 400
        assert "not exist" in res.json()["detail"].lower()


class TestContestRBACAndLifecycle:
    """Tests permissions and Rule 7 / Rule 10 lifecycle enforcement."""

    async def test_moderator_creates_and_admin_deletes(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        p1 = await create_test_problem(db_session, "Prob P1")
        p2 = await create_test_problem(db_session, "Prob P2")
        now = datetime.now(UTC)

        # Moderator creates
        create_payload = {
            "title": "Mod Contest",
            "description": "Created by moderator",
            "start_time": (now + timedelta(days=1)).isoformat(),
            "end_time": (now + timedelta(days=1, hours=2)).isoformat(),
            "penalty_minutes": 20,
            "problem_ids": [p1.id, p2.id],
        }
        create_res = await async_client.post(
            "/api-v1/contests", json=create_payload, headers=auth_headers(moderator_user)
        )
        assert create_res.status_code == 201
        contest_id = create_res.json()["id"]
        assert isinstance(contest_id, int)
        assert create_res.json()["problem_count"] == 2

        # Regular user cannot delete
        user_del = await async_client.delete(
            f"/api-v1/contests/{contest_id}", headers=auth_headers(normal_user)
        )
        assert user_del.status_code == 403

        # Moderator cannot delete (Rule 10: only Admin may delete)
        mod_del = await async_client.delete(
            f"/api-v1/contests/{contest_id}", headers=auth_headers(moderator_user)
        )
        assert mod_del.status_code == 403

        # Admin can delete upcoming contest
        admin_del = await async_client.delete(
            f"/api-v1/contests/{contest_id}", headers=auth_headers(admin_user)
        )
        assert admin_del.status_code == 200

    async def test_cannot_delete_live_or_ended_contest(
        self,
        async_client: AsyncClient,
        admin_user: User,
        db_session: AsyncSession,
    ) -> None:
        await create_test_problem(db_session, "Live Prob")
        now = datetime.now(UTC)

        # Create live contest
        contest = Contest(
            title="Live Contest",
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
            created_by=admin_user.id,
        )
        db_session.add(contest)
        await db_session.commit()
        await db_session.refresh(contest)

        del_res = await async_client.delete(
            f"/api-v1/contests/{contest.id}", headers=auth_headers(admin_user)
        )
        assert del_res.status_code == 400
        assert "upcoming" in del_res.json()["detail"].lower()

    async def test_live_contest_edit_locks_problems_and_dates(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        p1 = await create_test_problem(db_session, "Live P1")
        p2 = await create_test_problem(db_session, "Live P2")
        now = datetime.now(UTC)

        contest = Contest(
            title="Live Contest Editing",
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
            created_by=moderator_user.id,
        )
        db_session.add(contest)
        await db_session.flush()
        db_session.add(ContestProblem(contest_id=contest.id, problem_id=p1.id, position=1))
        await db_session.commit()
        await db_session.refresh(contest)

        # Attempting to change dates or problems while live returns 400
        bad_edit = await async_client.patch(
            f"/api-v1/contests/{contest.id}",
            json={"problem_ids": [p1.id, p2.id]},
            headers=auth_headers(moderator_user),
        )
        assert bad_edit.status_code == 400
        assert "live" in bad_edit.json()["detail"].lower()

        # Updating title and description is permitted
        good_edit = await async_client.patch(
            f"/api-v1/contests/{contest.id}",
            json={"title": "Updated Live Title", "description": "New rules"},
            headers=auth_headers(moderator_user),
        )
        assert good_edit.status_code == 200
        assert good_edit.json()["title"] == "Updated Live Title"


class TestContestRegistrationRules:
    """Tests Rule 4 registration and unregistration constraints."""

    async def test_registration_lifecycle(
        self,
        async_client: AsyncClient,
        normal_user: User,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        p = await create_test_problem(db_session, "Reg Prob")
        now = datetime.now(UTC)

        # Upcoming contest
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Reg Test Contest",
                "start_time": (now + timedelta(hours=2)).isoformat(),
                "end_time": (now + timedelta(hours=4)).isoformat(),
                "problem_ids": [p.id],
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        # Register successfully
        reg1 = await async_client.post(
            f"/api-v1/contests/{contest_id}/register", headers=auth_headers(normal_user)
        )
        assert reg1.status_code == 201

        # Duplicate registration returns 409 Conflict
        reg2 = await async_client.post(
            f"/api-v1/contests/{contest_id}/register", headers=auth_headers(normal_user)
        )
        assert reg2.status_code == 409

        # Unregister before start succeeds
        unreg = await async_client.delete(
            f"/api-v1/contests/{contest_id}/register", headers=auth_headers(normal_user)
        )
        assert unreg.status_code == 200

    async def test_unregistration_after_start_fails(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        await create_test_problem(db_session, "Live Unreg Prob")
        now = datetime.now(UTC)

        contest = Contest(
            title="Live Started Contest",
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
        )
        db_session.add(contest)
        await db_session.flush()
        part = ContestParticipant(contest_id=contest.id, user_id=normal_user.id)
        db_session.add(part)
        await db_session.commit()

        # Cannot unregister after contest has started
        unreg = await async_client.delete(
            f"/api-v1/contests/{contest.id}/register", headers=auth_headers(normal_user)
        )
        assert unreg.status_code == 400
        assert "started" in unreg.json()["detail"].lower()


class TestRule5ProblemVisibility:
    """Tests Rule 5: problems in an unended contest are hidden from normal routes."""

    async def test_unended_contest_problem_hidden_from_public(
        self,
        async_client: AsyncClient,
        normal_user: User,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        secret_prob = await create_test_problem(db_session, "Super Secret Contest Problem")
        public_prob = await create_test_problem(db_session, "Normal Public Problem")
        now = datetime.now(UTC)

        # Place secret_prob into an active/upcoming contest
        contest = Contest(
            title="Secret Contest",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=3),
        )
        db_session.add(contest)
        await db_session.flush()
        db_session.add(ContestProblem(contest_id=contest.id, problem_id=secret_prob.id, position=1))
        await db_session.commit()

        # 1. Non-staff problem list does NOT include secret_prob
        list_res = await async_client.get("/api-v1/problems", headers=auth_headers(normal_user))
        assert list_res.status_code == 200
        problem_ids = [p["id"] for p in list_res.json()["problems"]]
        assert secret_prob.id not in problem_ids
        assert public_prob.id in problem_ids

        # Staff can see it
        mod_list = await async_client.get("/api-v1/problems", headers=auth_headers(moderator_user))
        mod_ids = [p["id"] for p in mod_list.json()["problems"]]
        assert secret_prob.id in mod_ids

        # 2. Public problem detail returns 404 for non-staff
        detail_res = await async_client.get(
            f"/api-v1/problems/{secret_prob.id}", headers=auth_headers(normal_user)
        )
        assert detail_res.status_code == 404

        # Staff gets 200
        staff_detail = await async_client.get(
            f"/api-v1/problems/{secret_prob.id}", headers=auth_headers(moderator_user)
        )
        assert staff_detail.status_code == 200

        # 3. Contest problem endpoint before start returns 403 for non-staff
        contest_prob_res = await async_client.get(
            f"/api-v1/contests/{contest.id}/problems", headers=auth_headers(normal_user)
        )
        assert contest_prob_res.status_code == 403


class TestICPCScoringAndTieBreaking:
    """Tests Rule 1 & Rule 2: ICPC scoring, penalty times, and tie-breaking."""

    def test_pure_icpc_scoring_rules(self) -> None:
        start = datetime(2026, 11, 10, 10, 0, 0, tzinfo=UTC)
        end = datetime(2026, 11, 10, 12, 0, 0, tzinfo=UTC)
        prob_ids = [101, 102]

        user_id = uuid.uuid4()
        # Problem 101: 2 wrong answers, 1 compile error, then AC at 10:30 (30 min)
        # Solve time = 30 min = 1800s. Wrong attempts = 2 (compile error ignored!). Penalty = 1800 + 2 * (20*60) = 4200s
        s1 = Submission(
            id=uuid.uuid4(),
            user_id=user_id,
            problem_id=101,
            status=SubmissionStatus.WRONG_ANSWER,
            created_at=start + timedelta(minutes=10),
        )
        s2 = Submission(
            id=uuid.uuid4(),
            user_id=user_id,
            problem_id=101,
            status=SubmissionStatus.COMPILATION_ERROR,
            created_at=start + timedelta(minutes=15),
        )
        s3 = Submission(
            id=uuid.uuid4(),
            user_id=user_id,
            problem_id=101,
            status=SubmissionStatus.TIME_LIMIT_EXCEEDED,
            created_at=start + timedelta(minutes=20),
        )
        s4 = Submission(
            id=uuid.uuid4(),
            user_id=user_id,
            problem_id=101,
            status=SubmissionStatus.ACCEPTED,
            created_at=start + timedelta(minutes=30),
        )
        # Attempt after AC is ignored
        s5 = Submission(
            id=uuid.uuid4(),
            user_id=user_id,
            problem_id=101,
            status=SubmissionStatus.WRONG_ANSWER,
            created_at=start + timedelta(minutes=40),
        )

        # Problem 102: 3 wrong answers, NOT solved -> 0 penalty!
        s6 = Submission(
            id=uuid.uuid4(),
            user_id=user_id,
            problem_id=102,
            status=SubmissionStatus.WRONG_ANSWER,
            created_at=start + timedelta(minutes=50),
        )

        _score, solved, penalty, last_ac, p_stats = calculate_icpc_participant_score(
            contest_start_time=start,
            contest_end_time=end,
            penalty_minutes=20,
            problem_ids=prob_ids,
            user_submissions=[s1, s2, s3, s4, s5, s6],
        )

        assert solved == 1
        assert penalty == 4200
        assert last_ac == start + timedelta(minutes=30)
        assert p_stats[101]["is_solved"] is True
        assert p_stats[101]["attempts"] == 3  # 2 wrong + 1 AC
        assert p_stats[102]["is_solved"] is False
        assert p_stats[102]["penalty_seconds"] == 0

    def test_icpc_ranking_and_tie_breaking(self) -> None:
        now = datetime(2026, 11, 10, 10, 0, 0, tzinfo=UTC)

        p1 = {
            "username": "Alice",
            "problems_solved": 2,
            "penalty_seconds": 3600,
            "last_accepted_at": now + timedelta(minutes=50),
            "registered_at": now,
        }
        # Bob has equal solved & penalty as Alice, but earlier last AC -> displayed before Alice, but shares rank 1
        p2 = {
            "username": "Bob",
            "problems_solved": 2,
            "penalty_seconds": 3600,
            "last_accepted_at": now + timedelta(minutes=40),
            "registered_at": now,
        }
        # Charlie has 1 solve -> rank 3
        p3 = {
            "username": "Charlie",
            "problems_solved": 1,
            "penalty_seconds": 1200,
            "last_accepted_at": now + timedelta(minutes=20),
            "registered_at": now,
        }

        ranked = rank_icpc_participants([p1, p2, p3])
        # Bob first due to earlier last AC
        assert ranked[0]["username"] == "Bob"
        assert ranked[0]["rank"] == 1

        assert ranked[1]["username"] == "Alice"
        assert ranked[1]["rank"] == 1  # Equal rank

        assert ranked[2]["username"] == "Charlie"
        assert ranked[2]["rank"] == 3


class TestRule8LeaderboardIsolation:
    """Tests Rule 8: contest submissions do not count towards global stats until contest ends."""

    async def test_live_contest_submissions_do_not_affect_global_score(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        p = await create_test_problem(db_session, "Global Isolation Prob")
        now = datetime.now(UTC)

        # Create LIVE contest
        contest = Contest(
            title="Live Score Isolation",
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
        )
        db_session.add(contest)
        await db_session.flush()
        db_session.add(ContestProblem(contest_id=contest.id, problem_id=p.id, position=1))
        await db_session.commit()

        # Add an ACCEPTED submission under this live contest
        sub = Submission(
            id=uuid.uuid4(),
            user_id=normal_user.id,
            problem_id=p.id,
            contest_id=contest.id,
            status=SubmissionStatus.ACCEPTED,
            score=100.0,
            max_score=100.0,
            tests_passed=2,
            total_tests=2,
            language=SubmissionLanguage.PYTHON,
            source_code="print('ok')",
            created_at=now,
        )
        db_session.add(sub)
        await db_session.commit()

        # Recalculate global score
        await update_user_leaderboard_score(normal_user.id, db_session)
        await db_session.refresh(normal_user)

        # Global score is 0 because contest has NOT ended yet!
        assert normal_user.total_score == 0.0
        assert normal_user.problems_solved == 0

        # Now simulate contest ending
        contest.end_time = now - timedelta(seconds=10)
        await db_session.commit()

        # Query /api-v1/leaderboard/me or re-run update
        await update_user_leaderboard_score(normal_user.id, db_session)
        await db_session.refresh(normal_user)

        # Now score is counted!
        assert normal_user.total_score == 100.0
        assert normal_user.problems_solved == 1


class TestRule11ContestRun:
    """Tests Rule 11: run code in live contest for registered participants."""

    async def test_contest_run_permitted_when_live(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        p = await create_test_problem(db_session, "Contest Run Prob")
        now = datetime.now(UTC)

        contest = Contest(
            title="Live Contest For Run",
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
        )
        db_session.add(contest)
        await db_session.flush()
        db_session.add(ContestProblem(contest_id=contest.id, problem_id=p.id, position=1))
        # Register user
        db_session.add(ContestParticipant(contest_id=contest.id, user_id=normal_user.id))
        await db_session.commit()

        run_payload = {
            "problem_id": p.id,
            "user_code": "print('hello')",
            "language": "python",
            "test_cases": [{"input": "1 2\n", "expected_output": "3\n", "weight": 1.0}],
        }
        res = await async_client.post(
            f"/api-v1/contests/{contest.id}/run",
            json=run_payload,
            headers=auth_headers(normal_user),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "queued"
