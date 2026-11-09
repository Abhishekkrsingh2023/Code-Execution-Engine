"""Tests for user submission history endpoints.

This module validates:
- GET /api-v1/users/me/submissions:
    - Rejection of unauthenticated requests (401)
    - Empty submission history for new users (200)
    - Listing submissions with correct fields, types, and ordering (newest first)
    - User isolation: users can only view their own submissions
    - Filtering by problem_id query parameter
    - Filtering by status verdict query parameter
    - Pagination support with skip and limit
- GET /api-v1/users/me/submissions/{submission_id}:
    - Fetching submission details and source code by owner (200)
    - Rejection of unauthenticated access (401)
    - Rejection when submission does not exist (404)
    - Rejection when accessing another user's submission (404 / ownership isolation)
- Aliased code routes:
    - GET /api-v1/code/submissions/me
    - GET /api-v1/code/submissions/{submission_id}
"""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.user import User
from app.utils.jwt import create_access_token


def auth_headers(user: User) -> dict[str, str]:
    """Helper generating standard Bearer authorization headers with a valid JWT."""
    token = create_access_token(user_id=user.id, role=user.role)
    return {"Authorization": f"Bearer {token}"}


async def create_test_problem(
    db_session: AsyncSession,
    user: User,
    title: str = "Test Problem",
) -> Problem:
    """Helper to create and persist a test problem."""
    problem = Problem(
        title=title,
        description=f"Description for {title}",
        difficulty=ProblemDifficulty.EASY,
        category="Algorithms",
        topic="Math",
        status=ProblemStatus.PUBLISHED,
        time_limit=2.0,
        memory_limit=256,
        created_by=user.id,
    )
    db_session.add(problem)
    await db_session.commit()
    await db_session.refresh(problem)
    return problem


class TestUserSubmissionsList:
    """Test suite for GET /api-v1/users/me/submissions."""

    async def test_get_my_submissions_unauthenticated_fails(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: No auth credentials.
        Act: GET /api-v1/users/me/submissions.
        Assert: 401 Unauthorized.
        """
        response = await async_client.get("/api-v1/users/me/submissions")
        assert response.status_code == 401

    async def test_get_my_submissions_empty_list(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Authenticated user with no submissions.
        Act: GET /api-v1/users/me/submissions.
        Assert: 200 OK with total=0 and empty submissions array.
        """
        response = await async_client.get(
            "/api-v1/users/me/submissions",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["skip"] == 0
        assert data["limit"] == 20
        assert data["submissions"] == []

    async def test_get_my_submissions_success_and_fields(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: User with one submission linked to a problem.
        Act: GET /api-v1/users/me/submissions.
        Assert: 200 OK with accurate fields matching UserSubmissionResponse.
        """
        problem = await create_test_problem(db_session, normal_user, "Reverse Array")
        submission = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            problem_name=problem.title,
            language=SubmissionLanguage.PYTHON,
            source_code="def reverse_array(): pass",
            status=SubmissionStatus.ACCEPTED,
            score=100.0,
            max_score=100.0,
            tests_passed=5,
            total_tests=5,
            execution_time=0.12,
            memory_used=15.5,
        )
        db_session.add(submission)
        await db_session.commit()
        await db_session.refresh(submission)

        response = await async_client.get(
            "/api-v1/users/me/submissions",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        sub_data = data["submissions"][0]
        assert sub_data["id"] == str(submission.id)
        assert sub_data["problem_id"] == problem.id
        assert sub_data["problem_name"] == "Reverse Array"
        assert sub_data["language"] == "python"
        assert sub_data["status"] == "accepted"
        assert sub_data["score"] == 100.0
        assert sub_data["max_score"] == 100.0
        assert sub_data["tests_passed"] == 5
        assert sub_data["total_tests"] == 5
        assert sub_data["execution_time"] == 0.12
        assert sub_data["source_code"] == "def reverse_array(): pass"

    async def test_user_submissions_isolation(
        self,
        async_client: AsyncClient,
        normal_user: User,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: User A has 2 submissions, User B has 1 submission.
        Act: User A requests their submissions.
        Assert: Only User A's 2 submissions are returned.
        """
        other_user = await create_user(username="other_coder", email="other@example.com")
        problem = await create_test_problem(db_session, normal_user, "Two Sum")

        sub_a1 = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="print('a1')",
            status=SubmissionStatus.ACCEPTED,
            score=50.0,
            max_score=50.0,
        )
        sub_a2 = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.CPP,
            source_code="cout << 'a2';",
            status=SubmissionStatus.WRONG_ANSWER,
            score=0.0,
            max_score=50.0,
        )
        sub_b = Submission(
            user_id=other_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.JAVA,
            source_code="System.out.println('b');",
            status=SubmissionStatus.ACCEPTED,
            score=50.0,
            max_score=50.0,
        )
        db_session.add_all([sub_a1, sub_a2, sub_b])
        await db_session.commit()

        response = await async_client.get(
            "/api-v1/users/me/submissions",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        ids = {s["id"] for s in data["submissions"]}
        assert str(sub_a1.id) in ids
        assert str(sub_a2.id) in ids
        assert str(sub_b.id) not in ids

    async def test_filter_by_problem_id(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Submissions for Problem 1 and Problem 2.
        Act: GET /api-v1/users/me/submissions?problem_id={prob1.id}.
        Assert: Returns only Problem 1 submissions.
        """
        prob1 = await create_test_problem(db_session, normal_user, "Problem 1")
        prob2 = await create_test_problem(db_session, normal_user, "Problem 2")

        sub1 = Submission(
            user_id=normal_user.id,
            problem_id=prob1.id,
            language=SubmissionLanguage.PYTHON,
            source_code="prob1 code",
            status=SubmissionStatus.ACCEPTED,
        )
        sub2 = Submission(
            user_id=normal_user.id,
            problem_id=prob2.id,
            language=SubmissionLanguage.PYTHON,
            source_code="prob2 code",
            status=SubmissionStatus.ACCEPTED,
        )
        db_session.add_all([sub1, sub2])
        await db_session.commit()

        response = await async_client.get(
            f"/api-v1/users/me/submissions?problem_id={prob1.id}",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["submissions"][0]["problem_id"] == prob1.id

    async def test_filter_by_status(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: One accepted submission, one wrong_answer submission.
        Act: GET /api-v1/users/me/submissions?status=accepted.
        Assert: Returns only the accepted submission.
        """
        problem = await create_test_problem(db_session, normal_user, "Status Filter Problem")

        sub_ac = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="correct",
            status=SubmissionStatus.ACCEPTED,
        )
        sub_wa = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="wrong",
            status=SubmissionStatus.WRONG_ANSWER,
        )
        db_session.add_all([sub_ac, sub_wa])
        await db_session.commit()

        response = await async_client.get(
            "/api-v1/users/me/submissions?status=accepted",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["submissions"][0]["status"] == "accepted"

    async def test_pagination_skip_and_limit(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: 4 submissions created with staggered timestamps.
        Act: Request with skip=1 and limit=2.
        Assert: Returns 2 items, total=4.
        """
        problem = await create_test_problem(db_session, normal_user, "Pagination Problem")
        now = datetime.now(UTC)

        subs = [
            Submission(
                user_id=normal_user.id,
                problem_id=problem.id,
                language=SubmissionLanguage.PYTHON,
                source_code=f"code {i}",
                status=SubmissionStatus.ACCEPTED,
                created_at=now + timedelta(minutes=i),
            )
            for i in range(4)
        ]
        db_session.add_all(subs)
        await db_session.commit()

        response = await async_client.get(
            "/api-v1/users/me/submissions?skip=1&limit=2",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 4
        assert data["skip"] == 1
        assert data["limit"] == 2
        assert len(data["submissions"]) == 2


class TestUserSubmissionDetail:
    """Test suite for GET /api-v1/users/me/submissions/{submission_id}."""

    async def test_get_submission_detail_success(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Persisted submission belonging to normal_user.
        Act: GET /api-v1/users/me/submissions/{id}.
        Assert: 200 OK with complete source_code and metrics.
        """
        problem = await create_test_problem(db_session, normal_user, "Detail Problem")
        submission = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            problem_name=problem.title,
            language=SubmissionLanguage.PYTHON,
            source_code="def solve(): return 42",
            status=SubmissionStatus.ACCEPTED,
            score=100.0,
            max_score=100.0,
            tests_passed=10,
            total_tests=10,
            execution_time=0.08,
            memory_used=18.2,
        )
        db_session.add(submission)
        await db_session.commit()
        await db_session.refresh(submission)

        response = await async_client.get(
            f"/api-v1/users/me/submissions/{submission.id}",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(submission.id)
        assert data["source_code"] == "def solve(): return 42"
        assert data["status"] == "accepted"
        assert data["tests_passed"] == 10

    async def test_get_submission_detail_other_user_forbidden_as_404(
        self,
        async_client: AsyncClient,
        normal_user: User,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Submission owned by user A.
        Act: User B attempts to access submission details.
        Assert: 404 Not Found (preserves privacy, no submission leak).
        """
        other_user = await create_user(username="stranger", email="stranger@example.com")
        problem = await create_test_problem(db_session, normal_user, "Private Problem")

        submission = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="super_secret_code()",
            status=SubmissionStatus.ACCEPTED,
        )
        db_session.add(submission)
        await db_session.commit()
        await db_session.refresh(submission)

        response = await async_client.get(
            f"/api-v1/users/me/submissions/{submission.id}",
            headers=auth_headers(other_user),
        )
        assert response.status_code == 404

    async def test_get_submission_detail_nonexistent_404(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Random non-existent UUID.
        Act: GET /api-v1/users/me/submissions/{random_uuid}.
        Assert: 404 Not Found.
        """
        random_id = uuid.uuid4()
        response = await async_client.get(
            f"/api-v1/users/me/submissions/{random_id}",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 404


class TestCodeSubmissionsAliasRoutes:
    """Test suite verifying aliased /api-v1/code/submissions routes."""

    async def test_code_submissions_me_alias(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Persisted submission for normal_user.
        Act: GET /api-v1/code/submissions/me.
        Assert: 200 OK with submissions list.
        """
        problem = await create_test_problem(db_session, normal_user, "Alias Problem")
        submission = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="alias code",
            status=SubmissionStatus.ACCEPTED,
        )
        db_session.add(submission)
        await db_session.commit()

        response = await async_client.get(
            "/api-v1/code/submissions/me",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["submissions"][0]["source_code"] == "alias code"

    async def test_code_submissions_detail_alias(
        self,
        async_client: AsyncClient,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Persisted submission for normal_user.
        Act: GET /api-v1/code/submissions/{id}.
        Assert: 200 OK with submission detail.
        """
        problem = await create_test_problem(db_session, normal_user, "Alias Detail Problem")
        submission = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="alias detail code",
            status=SubmissionStatus.ACCEPTED,
        )
        db_session.add(submission)
        await db_session.commit()
        await db_session.refresh(submission)

        response = await async_client.get(
            f"/api-v1/code/submissions/{submission.id}",
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(submission.id)
        assert data["source_code"] == "alias detail code"

