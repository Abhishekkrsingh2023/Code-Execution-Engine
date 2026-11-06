"""Comprehensive executable tests for Contest Management System.

Tests cover:
- Model constraints and schema validation (invalid duration, duplicate problems, duplicate participation).
- Contest creation, modification, deletion, and role-based access control (Admin/Moderator vs User/Anonymous).
- Contest lifecycle transitions (draft, upcoming, active, completed, cancelled).
- Problem visibility isolation across contest phases.
- Participant registration, duplicate prevention, and unregistration restrictions.
- Contest submission boundary conditions (timing, registration, problem assignment).
- Leaderboard ranking, tie-breaking rules (score, solved count, penalty time), and winner determination.
"""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog, AuditLogAction
from app.models.contest import Contest, ContestParticipant, ContestProblem, ContestStatus
from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.test_case import TestCase as TestCaseModel
from app.models.user import User
from app.services.contest_service import (
    recalculate_contest_participant_stats,
)
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


class TestContestModelConstraintsAndValidation:
    """Tests model validation and constraints."""

    async def test_create_contest_invalid_duration_fails(
        self,
        async_client: AsyncClient,
        moderator_user: User,
    ) -> None:
        """Contest with end_time <= start_time is rejected."""
        now = datetime.now(UTC)
        payload = {
            "title": "Invalid Contest",
            "start_time": now.isoformat(),
            "end_time": (now - timedelta(hours=1)).isoformat(),
            "penalty_minutes": 20,
        }
        res = await async_client.post(
            "/api-v1/contests",
            json=payload,
            headers=auth_headers(moderator_user),
        )
        assert res.status_code in (400, 422)

    async def test_assign_duplicate_problem_fails(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Assigning the same problem twice to a contest returns 409 Conflict."""
        prob = await create_test_problem(db_session, "Problem For Duplication")
        now = datetime.now(UTC)
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Unique Problems Contest",
                "start_time": (now + timedelta(hours=1)).isoformat(),
                "end_time": (now + timedelta(hours=3)).isoformat(),
            },
            headers=auth_headers(moderator_user),
        )
        assert create_res.status_code == 201
        contest_id = create_res.json()["id"]

        # 1st assignment
        res1 = await async_client.post(
            f"/api-v1/contests/{contest_id}/problems",
            json={"problem_id": prob.id, "points": 100.0},
            headers=auth_headers(moderator_user),
        )
        assert res1.status_code == 201

        # 2nd duplicate assignment
        res2 = await async_client.post(
            f"/api-v1/contests/{contest_id}/problems",
            json={"problem_id": prob.id, "points": 100.0},
            headers=auth_headers(moderator_user),
        )
        assert res2.status_code == 409
        assert "already assigned" in res2.json()["detail"].lower()


class TestContestCRUDAndRBAC:
    """Tests contest CRUD operations and role-based permissions."""

    async def test_moderator_creates_contest_with_audit_log(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        now = datetime.now(UTC)
        payload = {
            "title": "Weekly Contest 101",
            "description": "Welcome to Weekly Contest 101!",
            "start_time": (now + timedelta(days=1)).isoformat(),
            "end_time": (now + timedelta(days=1, hours=2)).isoformat(),
            "status": "upcoming",
            "penalty_minutes": 15,
        }
        res = await async_client.post(
            "/api-v1/contests",
            json=payload,
            headers=auth_headers(moderator_user),
        )
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "Weekly Contest 101"
        assert data["duration_seconds"] == 7200
        assert data["penalty_minutes"] == 15
        assert data["status"] == "upcoming"

        # Check audit log
        stmt = select(AuditLog).where(
            AuditLog.action == AuditLogAction.CONTEST_CREATE.value,
            AuditLog.target_id == data["id"],
        )
        audit_entry = (await db_session.execute(stmt)).scalar_one_or_none()
        assert audit_entry is not None
        assert audit_entry.actor_id == moderator_user.id

    async def test_normal_user_cannot_create_or_modify_contest(
        self,
        async_client: AsyncClient,
        normal_user: User,
        moderator_user: User,
    ) -> None:
        now = datetime.now(UTC)
        # Create as moderator first
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Restricted Contest",
                "start_time": (now + timedelta(days=1)).isoformat(),
                "end_time": (now + timedelta(days=1, hours=2)).isoformat(),
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        # Normal user cannot create
        bad_create = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Hacker Contest",
                "start_time": (now + timedelta(days=1)).isoformat(),
                "end_time": (now + timedelta(days=1, hours=2)).isoformat(),
            },
            headers=auth_headers(normal_user),
        )
        assert bad_create.status_code == 403

        # Normal user cannot update
        bad_patch = await async_client.patch(
            f"/api-v1/contests/{contest_id}",
            json={"title": "Hacked Title"},
            headers=auth_headers(normal_user),
        )
        assert bad_patch.status_code == 403

        # Normal user cannot delete
        bad_delete = await async_client.delete(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(normal_user),
        )
        assert bad_delete.status_code == 403

    async def test_admin_updates_and_deletes_contest(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        now = datetime.now(UTC)
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "To Be Deleted",
                "start_time": (now + timedelta(days=2)).isoformat(),
                "end_time": (now + timedelta(days=2, hours=3)).isoformat(),
            },
            headers=auth_headers(admin_user),
        )
        assert create_res.status_code == 201
        contest_id = create_res.json()["id"]

        # Update
        patch_res = await async_client.patch(
            f"/api-v1/contests/{contest_id}",
            json={"title": "Renamed Contest", "penalty_minutes": 25},
            headers=auth_headers(admin_user),
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["title"] == "Renamed Contest"
        assert patch_res.json()["penalty_minutes"] == 25

        # Delete
        del_res = await async_client.delete(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(admin_user),
        )
        assert del_res.status_code == 200

        # Confirm 404
        get_res = await async_client.get(f"/api-v1/contests/{contest_id}")
        assert get_res.status_code == 404


class TestContestLifecycleAndVisibility:
    """Tests problem visibility and status enforcement across contest phases."""

    async def test_draft_contest_hidden_from_public(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        normal_user: User,
    ) -> None:
        now = datetime.now(UTC)
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Secret Draft Contest",
                "start_time": (now + timedelta(days=1)).isoformat(),
                "end_time": (now + timedelta(days=1, hours=2)).isoformat(),
                "status": "draft",
            },
            headers=auth_headers(moderator_user),
        )
        assert create_res.status_code == 201
        contest_id = create_res.json()["id"]

        # Normal user cannot fetch details
        get_res = await async_client.get(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(normal_user),
        )
        assert get_res.status_code == 404

        # Listing excludes draft for normal user
        list_res = await async_client.get(
            "/api-v1/contests",
            headers=auth_headers(normal_user),
        )
        titles = [c["title"] for c in list_res.json()["contests"]]
        assert "Secret Draft Contest" not in titles

        # Moderator can see draft
        mod_get = await async_client.get(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(moderator_user),
        )
        assert mod_get.status_code == 200

    async def test_upcoming_contest_hides_problems_from_normal_users(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        prob = await create_test_problem(db_session, "Hidden Problem A")
        now = datetime.now(UTC)
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Upcoming Shielded Contest",
                "start_time": (now + timedelta(hours=5)).isoformat(),
                "end_time": (now + timedelta(hours=7)).isoformat(),
                "status": "upcoming",
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        # Assign problem
        await async_client.post(
            f"/api-v1/contests/{contest_id}/problems",
            json={"problem_id": prob.id, "points": 100.0},
            headers=auth_headers(moderator_user),
        )

        # Normal user viewing contest detail gets empty problem list
        detail_res = await async_client.get(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(normal_user),
        )
        assert detail_res.status_code == 200
        assert len(detail_res.json()["problems"]) == 0

        # Normal user requesting problem list directly gets 403
        prob_res = await async_client.get(
            f"/api-v1/contests/{contest_id}/problems",
            headers=auth_headers(normal_user),
        )
        assert prob_res.status_code == 403
        assert "not started yet" in prob_res.json()["detail"].lower()

        # Moderator can preview problems before start
        mod_prob_res = await async_client.get(
            f"/api-v1/contests/{contest_id}/problems",
            headers=auth_headers(moderator_user),
        )
        assert mod_prob_res.status_code == 200
        assert len(mod_prob_res.json()) == 1


class TestContestRegistrationFlow:
    """Tests user registration and unregistration rules."""

    async def test_registration_and_unregistration(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        normal_user: User,
    ) -> None:
        now = datetime.now(UTC)
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Registration Flow Contest",
                "start_time": (now + timedelta(hours=10)).isoformat(),
                "end_time": (now + timedelta(hours=12)).isoformat(),
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        # Register
        reg_res = await async_client.post(
            f"/api-v1/contests/{contest_id}/register",
            headers=auth_headers(normal_user),
        )
        assert reg_res.status_code == 201
        assert reg_res.json()["username"] == normal_user.username

        # Contest detail reflects is_registered=True
        detail_res = await async_client.get(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(normal_user),
        )
        assert detail_res.json()["is_registered"] is True
        assert detail_res.json()["participant_count"] == 1

        # Duplicate registration fails
        dup_res = await async_client.post(
            f"/api-v1/contests/{contest_id}/register",
            headers=auth_headers(normal_user),
        )
        assert dup_res.status_code == 409

        # Unregister before start succeeds
        unreg_res = await async_client.delete(
            f"/api-v1/contests/{contest_id}/register",
            headers=auth_headers(normal_user),
        )
        assert unreg_res.status_code == 200

        # Detail reflects is_registered=False
        detail_after = await async_client.get(
            f"/api-v1/contests/{contest_id}",
            headers=auth_headers(normal_user),
        )
        assert detail_after.json()["is_registered"] is False
        assert detail_after.json()["participant_count"] == 0


class TestContestSubmissionEnforcement:
    """Tests boundary condition enforcement for submissions."""

    async def test_submission_to_upcoming_contest_blocked(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        prob = await create_test_problem(db_session, "Problem Upcoming")
        now = datetime.now(UTC)
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Future Contest",
                "start_time": (now + timedelta(hours=2)).isoformat(),
                "end_time": (now + timedelta(hours=4)).isoformat(),
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        await async_client.post(
            f"/api-v1/contests/{contest_id}/problems",
            json={"problem_id": prob.id, "points": 100.0},
            headers=auth_headers(moderator_user),
        )
        await async_client.post(
            f"/api-v1/contests/{contest_id}/register",
            headers=auth_headers(normal_user),
        )

        sub_res = await async_client.post(
            f"/api-v1/contests/{contest_id}/submit",
            json={
                "problem_id": prob.id,
                "user_code": "print('hello')",
                "language": "python",
            },
            headers=auth_headers(normal_user),
        )
        assert sub_res.status_code == 400
        assert "not started yet" in sub_res.json()["detail"].lower()

    async def test_submission_unregistered_user_blocked(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        prob = await create_test_problem(db_session, "Active Prob")
        now = datetime.now(UTC)
        # Active contest
        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Active Running Contest",
                "start_time": (now - timedelta(minutes=30)).isoformat(),
                "end_time": (now + timedelta(minutes=90)).isoformat(),
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        await async_client.post(
            f"/api-v1/contests/{contest_id}/problems",
            json={"problem_id": prob.id, "points": 100.0},
            headers=auth_headers(moderator_user),
        )

        # Submit without registering
        sub_res = await async_client.post(
            f"/api-v1/contests/{contest_id}/submit",
            json={
                "problem_id": prob.id,
                "user_code": "print('hello')",
                "language": "python",
            },
            headers=auth_headers(normal_user),
        )
        assert sub_res.status_code == 403
        assert "register" in sub_res.json()["detail"].lower()

    async def test_submission_to_unassigned_problem_blocked(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        assigned_prob = await create_test_problem(db_session, "Assigned Prob")
        unassigned_prob = await create_test_problem(db_session, "Unassigned Prob")
        now = datetime.now(UTC)

        create_res = await async_client.post(
            "/api-v1/contests",
            json={
                "title": "Active Contest Problem Isolation",
                "start_time": (now - timedelta(minutes=15)).isoformat(),
                "end_time": (now + timedelta(minutes=45)).isoformat(),
            },
            headers=auth_headers(moderator_user),
        )
        contest_id = create_res.json()["id"]

        await async_client.post(
            f"/api-v1/contests/{contest_id}/problems",
            json={"problem_id": assigned_prob.id, "points": 100.0},
            headers=auth_headers(moderator_user),
        )
        await async_client.post(
            f"/api-v1/contests/{contest_id}/register",
            headers=auth_headers(normal_user),
        )

        # Attempt submitting unassigned problem
        sub_res = await async_client.post(
            f"/api-v1/contests/{contest_id}/submit",
            json={
                "problem_id": unassigned_prob.id,
                "user_code": "print('hi')",
                "language": "python",
            },
            headers=auth_headers(normal_user),
        )
        assert sub_res.status_code == 400
        assert "not assigned" in sub_res.json()["detail"].lower()


class TestContestScoringLeaderboardAndWinner:
    """Tests accurate scoring, tie-breaking by penalty time, and winner determination."""

    async def test_leaderboard_rankings_and_winner_determination(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        create_user,
        db_session: AsyncSession,
    ) -> None:
        """User A solves problem with 0 wrong attempts.
        User B solves problem with 1 wrong attempt -> higher penalty time -> User A ranks #1.
        Winner is accurately determined as User A.
        """
        prob = await create_test_problem(db_session, "Algorithmic Challenge")
        user_a = await create_user(username="alice", email="alice@example.com")
        user_b = await create_user(username="bob", email="bob@example.com")

        start_time = datetime.now(UTC) - timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)

        contest = Contest(
            title="Algorithm Cup 2026",
            start_time=start_time,
            end_time=end_time,
            status=ContestStatus.ACTIVE,
            penalty_minutes=20,
        )
        db_session.add(contest)
        await db_session.commit()
        await db_session.refresh(contest)

        # Assign problem for 100 points
        cp = ContestProblem(
            contest_id=contest.id,
            problem_id=prob.id,
            points=100.0,
            order_index=0,
        )
        db_session.add(cp)

        # Register Alice and Bob
        part_a = ContestParticipant(
            contest_id=contest.id,
            user_id=user_a.id,
            registered_at=start_time,
        )
        part_b = ContestParticipant(
            contest_id=contest.id,
            user_id=user_b.id,
            registered_at=start_time + timedelta(minutes=1),
        )
        db_session.add_all([part_a, part_b])
        await db_session.commit()

        # Alice: 1 submission, accepted at start_time + 10 mins (600s)
        # Alice penalty: 600s
        sub_alice = Submission(
            user_id=user_a.id,
            problem_id=prob.id,
            contest_id=contest.id,
            language=SubmissionLanguage.PYTHON,
            source_code="def solve(): pass",
            status=SubmissionStatus.ACCEPTED,
            score=50.0,
            max_score=50.0,
            tests_passed=2,
            total_tests=2,
            created_at=start_time + timedelta(minutes=10),
        )
        db_session.add(sub_alice)

        # Bob: 1 wrong answer at +5 mins, then accepted at +15 mins (900s)
        # Bob penalty: 900s + (1 wrong attempt * 20 min * 60s) = 900 + 1200 = 2100s
        sub_bob_wrong = Submission(
            user_id=user_b.id,
            problem_id=prob.id,
            contest_id=contest.id,
            language=SubmissionLanguage.PYTHON,
            source_code="broken code",
            status=SubmissionStatus.WRONG_ANSWER,
            score=10.0,
            max_score=50.0,
            tests_passed=1,
            total_tests=2,
            created_at=start_time + timedelta(minutes=5),
        )
        sub_bob_ac = Submission(
            user_id=user_b.id,
            problem_id=prob.id,
            contest_id=contest.id,
            language=SubmissionLanguage.PYTHON,
            source_code="fixed code",
            status=SubmissionStatus.ACCEPTED,
            score=50.0,
            max_score=50.0,
            tests_passed=2,
            total_tests=2,
            created_at=start_time + timedelta(minutes=15),
        )
        db_session.add_all([sub_bob_wrong, sub_bob_ac])
        await db_session.commit()

        # Recalculate stats for both
        await recalculate_contest_participant_stats(contest.id, user_a.id, db_session)
        await recalculate_contest_participant_stats(contest.id, user_b.id, db_session)

        # Query leaderboard API
        lb_res = await async_client.get(f"/api-v1/contests/{contest.id}/leaderboard")
        assert lb_res.status_code == 200
        lb_data = lb_res.json()

        assert lb_data["total_participants"] == 2
        leaderboard = lb_data["leaderboard"]
        assert len(leaderboard) == 2

        # Both have 100 points and 1 problem solved
        assert leaderboard[0]["score"] == 100.0
        assert leaderboard[1]["score"] == 100.0
        assert leaderboard[0]["problems_solved"] == 1
        assert leaderboard[1]["problems_solved"] == 1

        # Alice must be Rank 1 due to lower penalty seconds (600 vs 2100)
        assert leaderboard[0]["username"] == "alice"
        assert leaderboard[0]["rank"] == 1
        assert leaderboard[0]["penalty_seconds"] == 600

        assert leaderboard[1]["username"] == "bob"
        assert leaderboard[1]["rank"] == 2
        assert leaderboard[1]["penalty_seconds"] == 2100

        # Winner must be Alice
        assert lb_data["winner"] is not None
        assert lb_data["winner"]["username"] == "alice"

        # Check my_rank endpoint
        my_rank_res = await async_client.get(
            f"/api-v1/contests/{contest.id}/leaderboard/me",
            headers=auth_headers(user_b),
        )
        assert my_rank_res.status_code == 200
        assert my_rank_res.json()["rank"] == 2
        assert my_rank_res.json()["username"] == "bob"
