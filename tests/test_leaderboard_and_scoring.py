import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.user import User, UserRole, UserStatus
from app.services.leaderboard_service import (
    record_submission_completion,
)
from app.utils.jwt import create_access_token


@pytest.fixture
async def sample_problem(db_session: AsyncSession) -> Problem:
    problem = Problem(
        title="Two Sum Problem",
        description="Calculate the sum of two integers.",
        difficulty=ProblemDifficulty.EASY,
        category="Algorithms",
        topic="Math",
        time_limit=2.0,
        memory_limit=256,
        status=ProblemStatus.PUBLISHED,
    )
    db_session.add(problem)
    await db_session.commit()
    await db_session.refresh(problem)
    return problem


@pytest.fixture
async def sample_problem_2(db_session: AsyncSession) -> Problem:
    problem = Problem(
        title="Reverse String",
        description="Reverse a given string.",
        difficulty=ProblemDifficulty.EASY,
        category="Strings",
        topic="String",
        time_limit=2.0,
        memory_limit=256,
        status=ProblemStatus.PUBLISHED,
    )
    db_session.add(problem)
    await db_session.commit()
    await db_session.refresh(problem)
    return problem


@pytest.fixture
async def user_alice(db_session: AsyncSession) -> User:
    user = User(
        username="alice",
        email="alice@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        is_email_verified=True,
        total_score=0.0,
        problems_solved=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def user_bob(db_session: AsyncSession) -> User:
    user = User(
        username="bob",
        email="bob@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        is_email_verified=True,
        total_score=0.0,
        problems_solved=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestSubmissionScoringAndLeaderboard:
    """Tests score calculations and leaderboard updates."""

    async def test_score_calculation_and_leaderboard_update(
        self,
        db_session: AsyncSession,
        sample_problem: Problem,
        user_alice: User,
    ) -> None:
        """Arrange: Alice submits code for sample_problem with 2 tests (weights: 40.0, 60.0).
        Act: Submission completes passing both tests.
        Assert: Alice's total score is updated to 100.0 and problems_solved is 1.
        """
        sub_id = uuid.uuid4()
        result_payload = {
            "status": "completed",
            "score": 100.0,
            "max_score": 100.0,
            "tests_passed": 2,
            "total_tests": 2,
            "time_taken": 0.12,
            "user_id": str(user_alice.id),
            "problem_id": sample_problem.id,
            "problem_name": sample_problem.title,
            "language": "python",
            "user_code": "def solve(): pass",
        }

        res = await record_submission_completion(sub_id, result_payload, db=db_session)

        assert res["score"] == 100.0
        assert res["tests_passed"] == 2
        assert res["user_total_score"] == 100.0
        assert res["user_problems_solved"] == 1

        # Check DB user stats
        await db_session.refresh(user_alice)
        assert user_alice.total_score == 100.0
        assert user_alice.problems_solved == 1

    async def test_resubmission_keeps_highest_score_per_problem(
        self,
        db_session: AsyncSession,
        sample_problem: Problem,
        user_alice: User,
    ) -> None:
        """Submitting a lower score on an already solved problem should not downgrade user total_score."""
        # Initial submission: 100 points
        sub_id_1 = uuid.uuid4()
        await record_submission_completion(
            sub_id_1,
            {
                "status": "completed",
                "score": 100.0,
                "max_score": 100.0,
                "tests_passed": 2,
                "total_tests": 2,
                "time_taken": 0.15,
                "user_id": str(user_alice.id),
                "problem_id": sample_problem.id,
                "problem_name": sample_problem.title,
            },
            db=db_session,
        )

        await db_session.refresh(user_alice)
        assert user_alice.total_score == 100.0

        # Submitting again with partial score: 40 points
        sub_id_2 = uuid.uuid4()
        res_2 = await record_submission_completion(
            sub_id_2,
            {
                "status": "failed",
                "score": 40.0,
                "max_score": 100.0,
                "tests_passed": 1,
                "total_tests": 2,
                "time_taken": 0.18,
                "user_id": str(user_alice.id),
                "problem_id": sample_problem.id,
                "problem_name": sample_problem.title,
            },
            db=db_session,
        )

        assert res_2["score"] == 40.0
        assert res_2["user_total_score"] == 100.0  # Still 100!

        await db_session.refresh(user_alice)
        assert user_alice.total_score == 100.0
        assert user_alice.problems_solved == 1

    async def test_solving_multiple_problems_accumulates_score(
        self,
        db_session: AsyncSession,
        sample_problem: Problem,
        sample_problem_2: Problem,
        user_alice: User,
    ) -> None:
        """Solving multiple problems correctly sums the best score across distinct problems."""
        # Problem 1: 80 points
        await record_submission_completion(
            uuid.uuid4(),
            {
                "status": "completed",
                "score": 80.0,
                "max_score": 100.0,
                "tests_passed": 2,
                "total_tests": 2,
                "user_id": str(user_alice.id),
                "problem_id": sample_problem.id,
                "problem_name": sample_problem.title,
            },
            db=db_session,
        )

        # Problem 2: 50 points
        await record_submission_completion(
            uuid.uuid4(),
            {
                "status": "completed",
                "score": 50.0,
                "max_score": 50.0,
                "tests_passed": 1,
                "total_tests": 1,
                "user_id": str(user_alice.id),
                "problem_id": sample_problem_2.id,
                "problem_name": sample_problem_2.title,
            },
            db=db_session,
        )

        await db_session.refresh(user_alice)
        assert user_alice.total_score == 130.0  # 80 + 50
        assert user_alice.problems_solved == 2


class TestLeaderboardRoutes:
    """Tests for GET /api-v1/leaderboard and /api-v1/leaderboard/me."""

    async def test_leaderboard_rankings_order(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        user_alice: User,
        user_bob: User,
    ) -> None:
        """Bob has 250 points, Alice has 150 points. Bob must be rank #1 and Alice rank #2."""
        user_bob.total_score = 250.0
        user_bob.problems_solved = 3
        user_alice.total_score = 150.0
        user_alice.problems_solved = 2
        await db_session.commit()

        response = await async_client.get("/api-v1/leaderboard")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 2
        users = data["users"]
        assert len(users) == 2

        # Bob is #1
        assert users[0]["username"] == "bob"
        assert users[0]["rank"] == 1
        assert users[0]["total_score"] == 250.0
        assert users[0]["problems_solved"] == 3
        assert "role" not in users[0]

        # Alice is #2
        assert users[1]["username"] == "alice"
        assert users[1]["rank"] == 2
        assert users[1]["total_score"] == 150.0
        assert users[1]["problems_solved"] == 2
        assert "role" not in users[1]

    async def test_leaderboard_excludes_admin_users(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        user_alice: User,
        admin_user: User,
    ) -> None:
        """Admins must not appear in the leaderboard or affect rankings."""
        admin_user.total_score = 999.0
        admin_user.problems_solved = 10
        user_alice.total_score = 50.0
        user_alice.problems_solved = 1
        await db_session.commit()

        response = await async_client.get("/api-v1/leaderboard")
        assert response.status_code == 200
        data = response.json()

        # Admin must not be included
        usernames = [u["username"] for u in data["users"]]
        assert admin_user.username not in usernames
        assert "alice" in usernames
        assert data["users"][0]["username"] == "alice"
        assert data["users"][0]["rank"] == 1
        assert "role" not in data["users"][0]

        # Admin calling /api-v1/leaderboard/me gets 404 (only role=user is ranked)
        admin_token = create_access_token(admin_user.id, admin_user.role)
        me_response = await async_client.get(
            "/api-v1/leaderboard/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert me_response.status_code == 404

    async def test_leaderboard_me_authenticated(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        user_alice: User,
        user_bob: User,
    ) -> None:
        """Authenticated Alice can fetch her personal rank and stats."""
        user_bob.total_score = 300.0
        user_alice.total_score = 100.0
        await db_session.commit()

        token = create_access_token(user_alice.id, user_alice.role)
        response = await async_client.get(
            "/api-v1/leaderboard/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "alice"
        assert data["rank"] == 2
        assert data["total_score"] == 100.0
        assert "role" not in data

    async def test_leaderboard_pagination(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        user_alice: User,
        user_bob: User,
    ) -> None:
        """Pagination returns correct limit and skip offsets."""
        user_bob.total_score = 250.0
        user_alice.total_score = 150.0
        await db_session.commit()

        # Page 1 (limit 1, skip 0)
        res1 = await async_client.get("/api-v1/leaderboard?skip=0&limit=1")
        assert res1.status_code == 200
        d1 = res1.json()
        assert d1["total"] == 2
        assert len(d1["users"]) == 1
        assert d1["users"][0]["username"] == "bob"
        assert d1["users"][0]["rank"] == 1

        # Page 2 (limit 1, skip 1)
        res2 = await async_client.get("/api-v1/leaderboard?skip=1&limit=1")
        assert res2.status_code == 200
        d2 = res2.json()
        assert d2["total"] == 2
        assert len(d2["users"]) == 1
        assert d2["users"][0]["username"] == "alice"
        assert d2["users"][0]["rank"] == 2

    async def test_submit_code_authenticated_and_poll_syncs_leaderboard(
        self,
        async_client: AsyncClient,
        redis_client,
        db_session: AsyncSession,
        sample_problem: Problem,
        user_alice: User,
    ) -> None:
        """When an authenticated user submits code with weighted tests and polls the result,
        the user's total score is updated on the leaderboard."""
        token = create_access_token(user_alice.id, user_alice.role)
        sub_uuid = str(uuid.uuid4())

        payload = {
            "submission_id": sub_uuid,
            "problem_id": sample_problem.id,
            "problem_name": sample_problem.title,
            "user_code": "def solve(): print('done')",
            "language": "python",
            "test_cases": [
                {"input": "1\n", "expected_output": "1\n", "weight": 40.0},
                {"input": "2\n", "expected_output": "2\n", "weight": 60.0},
            ],
            "time_limit": 2.0,
        }

        # 1. Submit code with auth
        res = await async_client.post(
            "/api-v1/code/submit-code",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200

        # Simulate worker finishing and setting verdict in Redis
        sub_key = f"submission:{sub_uuid}"
        await redis_client.hset(
            sub_key,
            mapping={
                "status": "completed",
                "score": 100.0,
                "max_score": 100.0,
                "tests_passed": 2,
                "total_tests": 2,
                "time_taken": 0.05,
            },
        )

        # 2. Poll submission
        poll_res = await async_client.get(f"/api-v1/code/submission/poll/{sub_uuid}")
        assert poll_res.status_code == 200

        # 3. Verify user's leaderboard score is updated!
        await db_session.refresh(user_alice)
        assert user_alice.total_score == 100.0
        assert user_alice.problems_solved == 1

        # 4. Check leaderboard endpoint
        lb_res = await async_client.get("/api-v1/leaderboard")
        assert lb_res.status_code == 200
        lb_data = lb_res.json()
        assert lb_data["users"][0]["username"] == "alice"
        assert lb_data["users"][0]["total_score"] == 100.0

    async def test_run_code_authenticated_and_poll_does_not_sync_leaderboard(
        self,
        async_client: AsyncClient,
        redis_client,
        db_session: AsyncSession,
        sample_problem: Problem,
        user_alice: User,
    ) -> None:
        """When an authenticated user runs code via /api-v1/code/run,
        polling the completed result does NOT update user total score or problems_solved on the leaderboard."""
        token = create_access_token(user_alice.id, user_alice.role)
        sub_uuid = str(uuid.uuid4())

        payload = {
            "submission_id": sub_uuid,
            "problem_id": sample_problem.id,
            "problem_name": sample_problem.title,
            "user_code": "def solve(): print('done')",
            "language": "python",
            "test_cases": [
                {"input": "1\n", "expected_output": "1\n", "weight": 50.0},
            ],
            "time_limit": 2.0,
        }

        # 1. Run code with auth
        res = await async_client.post(
            "/api-v1/code/run",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["mode"] == "run"

        # Simulate worker finishing and setting verdict in Redis for run mode
        sub_key = f"submission:{sub_uuid}"
        await redis_client.hset(
            sub_key,
            mapping={
                "status": "completed",
                "score": 50.0,
                "max_score": 50.0,
                "tests_passed": 1,
                "total_tests": 1,
                "time_taken": 0.05,
                "mode": "run",
            },
        )

        # 2. Poll submission
        poll_res = await async_client.get(f"/api-v1/code/submission/poll/{sub_uuid}")
        assert poll_res.status_code == 200
        assert poll_res.json()["mode"] == "run"

        # 3. Verify user's leaderboard score is NOT modified!
        await db_session.refresh(user_alice)
        assert user_alice.total_score == 0.0
        assert user_alice.problems_solved == 0
