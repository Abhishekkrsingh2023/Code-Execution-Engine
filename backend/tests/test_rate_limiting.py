"""Tests for SlowAPI rate limiting across key endpoints.

This module validates:
- GET /ping-redis (limit: 5/minute):
    - Allows requests up to the specified limit.
    - Returns 429 Too Many Requests with informative error message upon exceeding limit.
    - Recovers immediately when limiter storage is reset.
- POST /api-v1/users/otp/request (limit: 5/minute):
    - Enforces rate limiting on authentication OTP generation requests.
- POST /api-v1/users/login (limit: 10/minute):
    - Enforces rate limiting on password login attempts.
- POST /api-v1/code/run (limit: 4/minute):
    - Enforces rate limiting on code execution requests.
- Limiter disable/enable toggling:
    - Bypasses throttling when limiter.enabled is False.
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.limiter import limiter
from app.models.user import User
from app.utils.jwt import create_access_token


class TestRateLimiting:
    """Test suite for SlowAPI rate limiting behavior."""

    async def test_ping_redis_rate_limit_exceeded(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Mock Redis client returning True for ping.
        Act: Make 5 allowed requests to /ping-redis, followed by a 6th request.
        Assert:
        - First 5 requests return 200 OK.
        - 6th request returns 429 Too Many Requests.
        - Response body contains standard SlowAPI rate limit exceeded error detail.
        """
        mock_redis = AsyncMock()
        mock_redis.ping.return_value = True

        with patch("app.routers.root_routes.get_async_redis_client", return_value=mock_redis):
            for i in range(5):
                resp = await async_client.get("/ping-redis")
                assert resp.status_code == 200, f"Request {i + 1} should have succeeded"

            # 6th request exceeds 5/minute limit
            exceeded_resp = await async_client.get("/ping-redis")
            assert exceeded_resp.status_code == 429
            data = exceeded_resp.json()
            assert "error" in data
            assert "Rate limit exceeded" in data["error"]

    async def test_rate_limiter_reset_clears_hit_count(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Mock Redis client returning True.
        Act: Exceed the rate limit, verify 429, reset the limiter, then request again.
        Assert:
        - 6th request returns 429.
        - After limiter.reset(), the 7th request returns 200 OK.
        """
        mock_redis = AsyncMock()
        mock_redis.ping.return_value = True

        with patch("app.routers.root_routes.get_async_redis_client", return_value=mock_redis):
            for _ in range(5):
                await async_client.get("/ping-redis")

            blocked = await async_client.get("/ping-redis")
            assert blocked.status_code == 429

            # Reset the storage
            limiter.reset()

            resumed = await async_client.get("/ping-redis")
            assert resumed.status_code == 200

    async def test_otp_request_rate_limiting(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Non-existent email payload.
        Act: Send 5 OTP requests followed by a 6th request.
        Assert:
        - First 5 requests reach the controller and return 404 Not Found.
        - 6th request is throttled by SlowAPI and returns 429 Too Many Requests.
        """
        payload = {"email": "ratelimit_target@example.com"}

        for _ in range(5):
            resp = await async_client.post("/api-v1/users/otp/request", json=payload)
            assert resp.status_code == 404

        exceeded = await async_client.post("/api-v1/users/otp/request", json=payload)
        assert exceeded.status_code == 429
        assert "Rate limit exceeded" in exceeded.json()["error"]

    async def test_login_rate_limiting(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Invalid credentials payload.
        Act: Attempt 10 logins followed by an 11th request.
        Assert:
        - First 10 requests reach the authentication controller and return 401.
        - 11th request is throttled by SlowAPI and returns 429.
        """
        payload = {
            "username_or_email": "test_ratelimit_user",
            "password": "WrongPassword123!",
        }

        for _ in range(10):
            resp = await async_client.post("/api-v1/users/login", json=payload)
            assert resp.status_code == 401

        exceeded = await async_client.post("/api-v1/users/login", json=payload)
        assert exceeded.status_code == 429
        assert "Rate limit exceeded" in exceeded.json()["error"]

    async def test_code_run_rate_limiting(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Arrange: Authenticated code run payload with mocked execution handler.
        Act: Send 4 code run requests, then a 5th request.
        Assert:
        - First 4 requests reach the execution handler and return 200 OK.
        - 5th request is throttled by SlowAPI and returns 429 Too Many Requests.
        """
        payload = {
            "problem_id": 1,
            "user_code": "print('hello')",
            "language": "python",
        }
        token = create_access_token(user_id=normal_user.id, role=normal_user.role)
        headers = {"Authorization": f"Bearer {token}"}

        with patch(
            "app.routers.code_routes.handle_run_code_request", return_value={"status": "queued"}
        ):
            for _ in range(4):
                resp = await async_client.post("/api-v1/code/run", json=payload, headers=headers)
                assert resp.status_code == 200

            exceeded = await async_client.post("/api-v1/code/run", json=payload, headers=headers)
            assert exceeded.status_code == 429
            assert "Rate limit exceeded" in exceeded.json()["error"]

    async def test_rate_limiting_disabled_bypasses_limits(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Disable the limiter dynamically (limiter.enabled = False).
        Act: Send 7 requests (limit is 5/minute).
        Assert:
        - All 7 requests return 200 OK without any 429 errors.
        """
        mock_redis = AsyncMock()
        mock_redis.ping.return_value = True

        limiter.enabled = False
        try:
            with patch("app.routers.root_routes.get_async_redis_client", return_value=mock_redis):
                for _ in range(7):
                    resp = await async_client.get("/ping-redis")
                    assert resp.status_code == 200
        finally:
            limiter.enabled = True
