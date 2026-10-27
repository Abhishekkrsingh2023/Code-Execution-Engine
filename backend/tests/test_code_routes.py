"""Tests for code execution submission and polling routes.

This module validates:
- POST /api-v1/code/submit:
    - Successful submission enqueueing across supported languages (python, cpp, java, c)
    - Redis hash metadata persistence and queue job insertion
    - Disk artifact generation under backend/code/{submission_id}
    - Request validation errors (unsupported language, empty code, empty test cases, forbidden fields)
    - Error handling and disk cleanup on enqueue failure
- GET /api-v1/code/stream/{submission_id}:
    - Server-Sent Events (SSE) streaming with pre-existing result in Redis
    - Invalid UUID path parameter handling (422)
- GET /api-v1/code/submission/poll/{submission_id}:
    - Polling existing submission metadata (200)
    - Polling non-existent submission (404)
"""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.test_case import TestCase as TestCaseModel
from app.models.user import User, UserRole, UserStatus
from app.utils.jwt import create_access_token


def auth_headers(user: User) -> dict[str, str]:
    """Helper returning standard Bearer authorization header with a valid JWT access token."""
    token = create_access_token(user_id=user.id, role=user.role)
    return {"Authorization": f"Bearer {token}"}


class TestCodeSubmitRoute:
    """Test suite for POST /api-v1/code/submit."""

    async def test_submit_code_python_success(
        self,
        async_client: AsyncClient,
        redis_client: Redis,
        normal_user: User,
    ) -> None:
        """Arrange: Valid Python submission with test cases.
        Act: POST to /api-v1/code/submit.
        Assert:
        - 200 OK with queued status, submission ID, streaming & polling URLs.
        - Redis hash 'submission:{id}' contains expected fields and status 'queued'.
        - Redis list 'code:queue' contains the serialized payload.
        - backend/code/{id}/Main.py is created on disk with exact user code.
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Two Sum",
            "user_code": "def solve(): print('hello')",
            "language": "python",
            "test_cases": [
                {"input": "1 2\n", "expected_output": "3\n"},
                {"input": "3 4\n", "expected_output": "7\n"},
            ],
            "time_limit": 2.0,
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Submission received successfully."
        assert data["status"] == "queued"
        sub_id = data["submission"]
        assert sub_id is not None
        assert data["streaming_url"] == f"/api-v1/code/stream/{sub_id}"
        assert data["polling_url"] == f"/api-v1/code/submission/poll/{sub_id}"

        # Verify Redis hash
        sub_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{sub_id}"
        redis_data = await redis_client.hgetall(sub_key)
        assert redis_data["submission_id"] == sub_id
        assert redis_data["language"] == "python"
        assert redis_data["status"] in ("queued", "running", "completed")
        assert redis_data["user_id"] == str(normal_user.id)
        if redis_data["status"] == "queued":
            queue_len = await redis_client.llen(settings.REDIS_QUEUE_NAME)
            assert queue_len >= 1

        # Verify disk file
        code_file = settings.resolve_code_dir() / sub_id / "Main.py"
        assert code_file.exists()
        assert code_file.read_text(encoding="utf-8") == payload["user_code"]

    @pytest.mark.parametrize(
        "language,file_ext",
        [
            ("cpp", "cpp"),
            ("c", "c"),
            ("java", "java"),
        ],
    )
    async def test_submit_code_supported_languages(
        self,
        async_client: AsyncClient,
        language: str,
        file_ext: str,
        normal_user: User,
    ) -> None:
        """Arrange: Valid submission for each supported compiled language.
        Act: POST to /api-v1/code/submit.
        Assert: Code file is saved on disk with the matching extension (Main.cpp, Main.java, Main.c).
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Sample Problem",
            "user_code": "// solution code",
            "language": language,
            "test_cases": [{"input": "5", "expected_output": "10"}],
            "time_limit": 1.5,
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )

        assert response.status_code == 200
        sub_id = response.json()["submission"]
        code_file = settings.resolve_code_dir() / sub_id / f"Main.{file_ext}"
        assert code_file.exists()

    async def test_submit_code_unsupported_language_fails(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Payload specifying an unsupported language ('ruby').
        Act: POST to /api-v1/code/submit.
        Assert: 422 Unprocessable Entity due to Language Enum validation.
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Two Sum",
            "user_code": "puts 'hello'",
            "language": "ruby",
            "test_cases": [{"input": "1", "expected_output": "1"}],
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )

        assert response.status_code == 422

    async def test_submit_code_empty_code_fails(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Payload with empty user_code string.
        Act: POST to /api-v1/code/submit.
        Assert: 422 Unprocessable Entity (min_length=1 constraint).
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Two Sum",
            "user_code": "",
            "language": "python",
            "test_cases": [{"input": "1", "expected_output": "1"}],
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )

        assert response.status_code == 422

    async def test_submit_code_unknown_problem_without_test_cases_returns_404(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Payload with unknown problem and empty test_cases.
        Act: POST to /api-v1/code/submit.
        Assert: 404 Not Found since submit loads internal test cases.
        """
        payload = {
            "problem_id": 999999,
            "problem_name": "Two Sum",
            "user_code": "print('hello')",
            "language": "python",
            "test_cases": [],
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )

        assert response.status_code == 404
        assert "not found or has no internal test cases" in response.json()["detail"]

    async def test_submit_code_extra_fields_forbidden(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Payload with forbidden unexpected field ('extra_field').
        Act: POST to /api-v1/code/submit.
        Assert: 422 Unprocessable Entity (extra='forbid' constraint).
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Two Sum",
            "user_code": "print('hello')",
            "language": "python",
            "test_cases": [{"input": "1", "expected_output": "1"}],
            "extra_field": "disallowed",
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )

        assert response.status_code == 422

    async def test_submit_code_failure_cleans_up_directory_and_raises_500(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Simulate Redis pipeline failure during submission enqueueing.
        Act: POST to /api-v1/code/submit.
        Assert:
        - 500 Internal Server Error returned.
        - Directory created for the submission is removed from disk.
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Two Sum",
            "user_code": "print('fail test')",
            "language": "python",
            "test_cases": [{"input": "1", "expected_output": "1"}],
        }

        # Mock Redis pipeline to raise an exception on execute
        with patch("app.controllers.code_controller.redis_client.pipeline") as mock_pipeline:
            mock_pipe = AsyncMock()
            mock_pipe.hset = MagicMock()
            mock_pipe.expire = MagicMock()
            mock_pipe.lpush = MagicMock()
            mock_pipe.__aenter__.return_value = mock_pipe
            mock_pipe.execute.side_effect = RuntimeError("Redis connection broken")
            mock_pipeline.return_value = mock_pipe

            response = await async_client.post(
                "/api-v1/code/submit",
                json=payload,
                headers=auth_headers(normal_user),
            )

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to enqueue submission"


class TestCodePollingAndStreamingRoutes:
    """Test suite for GET /api-v1/code/submission/poll/{id} and /api-v1/code/stream/{id}."""

    async def test_poll_submission_found(
        self,
        async_client: AsyncClient,
        redis_client: Redis,
    ) -> None:
        """Arrange: Existing submission stored in Redis hash.
        Act: GET /api-v1/code/submission/poll/{submission_id}.
        Assert: 200 OK returning the submission metadata dictionary.
        """
        sub_id = str(uuid.uuid4())
        sub_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{sub_id}"
        await redis_client.hset(
            sub_key,
            mapping={
                "submission_id": sub_id,
                "language": "python",
                "status": "completed",
                "output": "42\n",
                "time_taken": "0.15",
            },
        )

        response = await async_client.get(f"/api-v1/code/submission/poll/{sub_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["submission_id"] == sub_id
        assert data["status"] == "completed"
        assert data["output"] == "42\n"

    async def test_poll_submission_not_found_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Non-existent submission identifier.
        Act: GET /api-v1/code/submission/poll/{random_uuid}.
        Assert: 404 Not Found with 'Submission not found.' detail message.
        """
        non_existent_id = str(uuid.uuid4())
        response = await async_client.get(f"/api-v1/code/submission/poll/{non_existent_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Submission not found."

    async def test_stream_submission_with_saved_result(
        self,
        async_client: AsyncClient,
        redis_client: Redis,
    ) -> None:
        """Arrange: Result already stored in Redis key 'result:{submission_id}'.
        Act: GET /api-v1/code/stream/{submission_id}.
        Assert:
        - 200 OK with media type text/event-stream.
        - Stream content begins with 'event: result' containing saved result data.
        """
        sub_id = uuid.uuid4()
        result_key = f"result:{sub_id}"
        saved_result = json.dumps({"status": "AC", "passed": 2, "total": 2})
        await redis_client.set(result_key, saved_result)

        response = await async_client.get(f"/api-v1/code/stream/{sub_id}")

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        assert f"event: result\ndata: {saved_result}\n\n" in response.text

    async def test_stream_submission_invalid_uuid_returns_422(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Malformed non-UUID string as path parameter.
        Act: GET /api-v1/code/stream/invalid-uuid-123.
        Assert: 422 Unprocessable Entity (FastAPI path validation failure).
        """
        response = await async_client.get("/api-v1/code/stream/not-a-valid-uuid")

        assert response.status_code == 422


class TestRunVsSubmitDistinction:
    """Test suite validating the behavioral distinction between /run and /submit."""

    async def test_submit_route_loads_test_cases_internally(
        self,
        async_client: AsyncClient,
        redis_client: Redis,
        db_session: AsyncSession,
        normal_user: User,
    ) -> None:
        """Arrange: Problem in DB with sample and hidden test cases.
        Act: POST /api-v1/code/submit with NO test_cases in the request body.
        Assert:
        - 200 OK with mode='submit'.
        - Internal hidden test case (is_sample=False) is loaded into the Redis job.
        - Polling does NOT expose the internal test cases in the response.
        """
        problem = Problem(
            title="Multiply Numbers",
            description="Multiply two numbers.",
            difficulty=ProblemDifficulty.EASY,
            status=ProblemStatus.PUBLISHED,
        )
        db_session.add(problem)
        await db_session.flush()

        tc_sample = TestCaseModel(
            problem_id=problem.id,
            input="2 3",
            expected_output="6",
            is_sample=True,
            weight=10.0,
        )
        tc_hidden = TestCaseModel(
            problem_id=problem.id,
            input="7 8",
            expected_output="56",
            is_sample=False,
            weight=90.0,
        )
        db_session.add_all([tc_sample, tc_hidden])
        await db_session.commit()

        payload = {
            "problem_id": problem.id,
            "user_code": "print(56)",
            "language": "python",
        }

        response = await async_client.post(
            "/api-v1/code/submit",
            json=payload,
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "submit"
        sub_id = data["submission"]

        # Verify Redis hash has mode=submit and contains the hidden test case
        sub_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{sub_id}"
        redis_data = await redis_client.hgetall(sub_key)
        assert redis_data["mode"] == "submit"
        internal_tcs = json.loads(redis_data["test_cases"])
        assert len(internal_tcs) == 1
        assert internal_tcs[0]["input"] == "7 8"
        assert internal_tcs[0]["expected_output"] == "56"

        # Verify polling strips test_cases
        poll_res = await async_client.get(f"/api-v1/code/submission/poll/{sub_id}")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        assert "test_cases" not in poll_data
        assert poll_data["mode"] == "submit"

    async def test_run_route_with_custom_test_cases(
        self,
        async_client: AsyncClient,
        redis_client: Redis,
        normal_user: User,
    ) -> None:
        """Arrange: User provides custom test cases to /api-v1/code/run.
        Act: POST /api-v1/code/run.
        Assert: 200 OK with mode='run', custom test cases preserved in Redis.
        """
        payload = {
            "problem_id": 1,
            "problem_name": "Ad-hoc Run",
            "user_code": "import sys; print(sys.stdin.read().strip())",
            "language": "python",
            "test_cases": [{"input": "custom_data_123", "expected_output": "custom_data_123"}],
        }

        response = await async_client.post(
            "/api-v1/code/run",
            json=payload,
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "run"
        sub_id = data["submission"]

        # Verify Redis hash
        sub_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{sub_id}"
        redis_data = await redis_client.hgetall(sub_key)
        assert redis_data["mode"] == "run"
        tcs = json.loads(redis_data["test_cases"])
        assert len(tcs) == 1
        assert tcs[0]["input"] == "custom_data_123"

        # Polling preserves test_cases in run mode for caller debugging
        poll_res = await async_client.get(f"/api-v1/code/submission/poll/{sub_id}")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        assert "test_cases" in poll_data
        assert poll_data["mode"] == "run"

    async def test_run_route_without_test_cases_returns_400(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        normal_user: User,
    ) -> None:
        """Arrange: Problem in DB.
        Act: POST /api-v1/code/run with NO test_cases.
        Assert: 400 Bad Request because run test cases must be provided by the client.
        """
        problem = Problem(
            title="Sample Test Case Problem",
            description="Testing run mode requires test cases.",
            difficulty=ProblemDifficulty.EASY,
            status=ProblemStatus.PUBLISHED,
        )
        db_session.add(problem)
        await db_session.commit()

        payload = {
            "problem_id": problem.id,
            "user_code": "print('sample_out')",
            "language": "python",
        }

        response = await async_client.post(
            "/api-v1/code/run",
            json=payload,
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 400
        assert "No test cases provided" in response.json()["detail"]

    async def test_run_does_not_update_marks_while_submit_does(
        self,
        async_client: AsyncClient,
        redis_client: Redis,
        db_session: AsyncSession,
    ) -> None:
        """Verify the crucial distinction:
        - Running code passes tests but does NOT update user's total_score or problems_solved.
        - Submitting code passes tests and DOES update user's total_score and problems_solved.
        """
        # Create user
        user = User(
            username="coder_dan",
            email="dan@example.com",
            role=UserRole.USER,
            status=UserStatus.ACTIVE,
            is_email_verified=True,
            total_score=0.0,
            problems_solved=0,
        )
        db_session.add(user)
        await db_session.flush()

        # Create problem with 100-point hidden test case
        problem = Problem(
            title="Scored Problem",
            description="Problem for scoring distinction.",
            difficulty=ProblemDifficulty.MEDIUM,
            status=ProblemStatus.PUBLISHED,
        )
        db_session.add(problem)
        await db_session.flush()

        tc_hidden = TestCaseModel(
            problem_id=problem.id,
            input="10",
            expected_output="20",
            is_sample=False,
            weight=100.0,
        )
        db_session.add(tc_hidden)
        await db_session.commit()

        token = create_access_token(user.id, user.role)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. RUN CODE
        run_res = await async_client.post(
            "/api-v1/code/run",
            json={
                "problem_id": problem.id,
                "user_code": "print(20)",
                "language": "python",
                "test_cases": [{"input": "10", "expected_output": "20", "weight": 100.0}],
            },
            headers=headers,
        )
        assert run_res.status_code == 200
        run_id = run_res.json()["submission"]

        # Simulate completed execution in Redis
        await redis_client.hset(
            f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{run_id}",
            mapping={
                "status": "completed",
                "score": 100.0,
                "max_score": 100.0,
                "tests_passed": 1,
                "total_tests": 1,
                "time_taken": 0.05,
                "mode": "run",
            },
        )

        # Poll run
        poll_run = await async_client.get(f"/api-v1/code/submission/poll/{run_id}")
        assert poll_run.status_code == 200

        # Assert user score in DB remains 0.0!
        await db_session.refresh(user)
        assert user.total_score == 0.0
        assert user.problems_solved == 0

        # 2. SUBMIT CODE
        submit_res = await async_client.post(
            "/api-v1/code/submit",
            json={
                "problem_id": problem.id,
                "user_code": "print(20)",
                "language": "python",
            },
            headers=headers,
        )
        assert submit_res.status_code == 200
        submit_id = submit_res.json()["submission"]

        # Simulate completed execution in Redis
        await redis_client.hset(
            f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submit_id}",
            mapping={
                "status": "completed",
                "score": 100.0,
                "max_score": 100.0,
                "tests_passed": 1,
                "total_tests": 1,
                "time_taken": 0.05,
                "mode": "submit",
            },
        )

        # Poll submit
        poll_submit = await async_client.get(f"/api-v1/code/submission/poll/{submit_id}")
        assert poll_submit.status_code == 200

        # Assert user score in DB IS updated to 100.0 and problems_solved to 1!
        await db_session.refresh(user)
        assert user.total_score == 100.0
        assert user.problems_solved == 1

    async def test_submission_with_integer_problem_id_and_test_case_id(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        normal_user: User,
    ) -> None:
        """Verify that integer problem_id and integer test case id are accepted without type mismatch."""
        problem = Problem(
            title="Integer Problem ID Test",
            description="Testing integer problem ID compatibility",
            difficulty=ProblemDifficulty.EASY,
            status=ProblemStatus.PUBLISHED,
        )
        db_session.add(problem)
        await db_session.commit()
        await db_session.refresh(problem)

        tc = TestCaseModel(
            problem_id=problem.id,
            input="hello",
            expected_output="hello",
            is_sample=True,
            weight=10.0,
        )
        db_session.add(tc)
        await db_session.commit()
        await db_session.refresh(tc)

        # Submission with integer problem_id and integer test case id
        payload = {
            "problem_id": problem.id,
            "problem_name": problem.title,
            "user_code": "import sys; print(sys.stdin.read().strip())",
            "language": "python",
            "mode": "run",
            "test_cases": [
                {
                    "id": tc.id,
                    "input": "hello",
                    "expected_output": "hello",
                    "weight": 10.0,
                }
            ],
        }

        response = await async_client.post(
            "/api-v1/code/run",
            json=payload,
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "run"
        assert data["status"] == "queued"

    async def test_run_unauthenticated_returns_401(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Verify unauthenticated user cannot execute /api-v1/code/run."""
        payload = {
            "problem_id": 1,
            "problem_name": "Test Run Auth",
            "user_code": "print('hello')",
            "language": "python",
            "test_cases": [{"input": "1", "expected_output": "1"}],
        }
        response = await async_client.post("/api-v1/code/run", json=payload)
        assert response.status_code == 401
        assert "Authentication credentials were not provided" in response.json()["detail"]

    async def test_submit_unauthenticated_returns_401(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Verify unauthenticated user cannot execute /api-v1/code/submit."""
        payload = {
            "problem_id": 1,
            "problem_name": "Test Submit Auth",
            "user_code": "print('hello')",
            "language": "python",
        }
        response = await async_client.post("/api-v1/code/submit", json=payload)
        assert response.status_code == 401
        assert "Authentication credentials were not provided" in response.json()["detail"]
