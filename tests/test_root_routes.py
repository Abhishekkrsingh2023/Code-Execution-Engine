"""Tests for root utility routes.

This module validates:
- GET /health: Basic health check endpoint
- GET /ping-redis: Redis connectivity check under normal, failure, and error conditions
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


class TestRootRoutes:
    """Test suite for root system routes (/health, /ping-redis)."""

    async def test_health_check_returns_200_and_healthy_status(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: FastAPI app is initialized.
        Act: GET request to /health.
        Assert: 200 OK status code with {"status": "healthy"}.
        """
        response = await async_client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    async def test_ping_redis_success(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Redis server is running and accessible.
        Act: GET request to /ping-redis.
        Assert: 200 OK status code with {"message": "Pong from Redis!"}.
        """
        response = await async_client.get("/ping-redis")

        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Pong from Redis!"

    async def test_ping_redis_when_redis_returns_false(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Mock Redis client returning False for ping.
        Act: GET request to /ping-redis.
        Assert: 200 OK with {"message": "Failed to ping Redis."}.
        """
        mock_redis = AsyncMock()
        mock_redis.ping.return_value = False

        with patch("app.routers.root_routes.get_async_redis_client", return_value=mock_redis):
            response = await async_client.get("/ping-redis")

        assert response.status_code == 200
        assert response.json() == {"message": "Failed to ping Redis."}

    async def test_ping_redis_when_exception_raised(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Mock Redis client raising ConnectionError on ping.
        Act: GET request to /ping-redis.
        Assert: 500 Internal Server Error with a safe error description.
        """
        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = ConnectionError("Could not connect to Redis server")

        with patch("app.routers.root_routes.get_async_redis_client", return_value=mock_redis):
            response = await async_client.get("/ping-redis")

        assert response.status_code == 500
        assert response.json() == {"detail": "Failed to ping Redis."}
