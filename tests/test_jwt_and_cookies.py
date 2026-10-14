"""Tests for JWT token implementation, refresh token rotation, and cookie-based authentication.

Validates:
- Access token generation:
    - User unique identifier (sub) and role claims.
    - Issued-at (iat) and expiration (exp) claims.
    - Token type strictly set to 'access'.
    - Short lifetime (15 minutes).
- Refresh token generation:
    - User unique identifier (sub), expiration (exp), issued-at (iat).
    - Unique token identifier (jti) for rotation tracking.
    - Token type strictly set to 'refresh'.
    - Longer lifetime (7 days).
- Token type validation:
    - Refresh token rejected on protected API endpoints (never accepted as access token).
    - Access token rejected on token refresh endpoint.
- Cookie-based authentication:
    - Password login sets HTTP-only access_token and refresh_token cookies.
    - OTP verification sets HTTP-only access_token and refresh_token cookies.
    - Authenticating protected endpoints using cookies without Authorization header.
- Refresh token rotation & reuse prevention:
    - Valid refresh token yields new access token and rotated refresh token.
    - Previous refresh token is invalidated / revoked.
    - Replay / reuse of an invalidated refresh token triggers security revocation of all sessions.
- User logout:
    - Logout endpoint clears authentication cookies and revokes refresh token.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models.user import User, UserRole
from app.utils.jwt import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    verify_access_token,
    verify_refresh_token,
)
from app.utils.token_service import is_refresh_token_revoked
from tests.conftest import CreateUserCallable


class TestJWTTokenGenerationAndValidation:
    """Unit tests for JWT generation, claim contents, and type enforcement."""

    def test_access_token_claims_and_expiration(self) -> None:
        """Verify access token contains sub, role, type='access', jti, iat, exp (~15 mins)."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id=user_id, role=UserRole.ADMIN)

        payload = decode_jwt_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["role"] == "admin"
        assert payload["type"] == "access"
        assert "jti" in payload
        assert "iat" in payload
        assert "exp" in payload

        # Check ~15 minute lifetime
        lifetime_seconds = payload["exp"] - payload["iat"]
        assert 14 * 60 <= lifetime_seconds <= 16 * 60

    def test_refresh_token_claims_and_expiration(self) -> None:
        """Verify refresh token contains sub, type='refresh', jti, iat, exp (~7 days)."""
        user_id = uuid.uuid4()
        token, jti, _ = create_refresh_token(user_id=user_id)

        payload = decode_jwt_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"
        assert payload["jti"] == jti
        assert "iat" in payload
        assert "exp" in payload

        # Check ~7 day lifetime
        expected_seconds = 7 * 86400
        lifetime_seconds = payload["exp"] - payload["iat"]
        assert expected_seconds - 60 <= lifetime_seconds <= expected_seconds + 60

    def test_expired_token_rejected(self) -> None:
        """Expired JWT token raises 401 Unauthorized."""
        user_id = uuid.uuid4()
        # Create token already expired in the past
        past_delta = timedelta(minutes=-5)
        expired_token = create_access_token(user_id=user_id, role="user", expires_delta=past_delta)

        with pytest.raises(Exception) as exc_info:
            verify_access_token(expired_token)
        assert "expired" in str(exc_info.value.detail).lower()

    def test_never_accept_refresh_token_as_access_token(self) -> None:
        """A refresh token MUST NEVER be accepted as an access token."""
        user_id = uuid.uuid4()
        refresh_tok, _, _ = create_refresh_token(user_id=user_id)

        with pytest.raises(Exception) as exc_info:
            verify_access_token(refresh_tok)
        assert exc_info.value.status_code == 401
        assert "refresh token cannot be used to authenticate" in str(exc_info.value.detail).lower()

    def test_never_accept_access_token_on_refresh(self) -> None:
        """An access token MUST NEVER be accepted on the refresh endpoint."""
        user_id = uuid.uuid4()
        access_tok = create_access_token(user_id=user_id, role="user")

        with pytest.raises(Exception) as exc_info:
            verify_refresh_token(access_tok)
        assert exc_info.value.status_code == 401
        assert "refresh token is required" in str(exc_info.value.detail).lower()

    def test_tampered_signature_rejected(self) -> None:
        """Tampered JWT signature raises 401 Unauthorized."""
        user_id = uuid.uuid4()
        valid_token = create_access_token(user_id=user_id, role="user")
        tampered_token = valid_token[:-4] + "fake"

        with pytest.raises(Exception) as exc_info:
            decode_jwt_token(tampered_token)
        assert exc_info.value.status_code == 401


class TestCookieAuthentication:
    """Tests for HTTP-only cookie-based authentication for password and OTP logins."""

    async def test_password_login_sets_auth_cookies(
        self,
        async_client: AsyncClient,
        create_user: CreateUserCallable,
    ) -> None:
        """Password login sets access_token and refresh_token HTTP-only cookies."""
        user = await create_user(
            username="cookie_user",
            email="cookie@example.com",
            password="SecurePassword123!",
            is_email_verified=True,
        )

        response = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": "cookie_user", "password": "SecurePassword123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Login successful."
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert "token_type" not in data

        # Check response cookies
        assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

        # Verify access token decodes properly
        access_cookie = response.cookies[settings.ACCESS_TOKEN_COOKIE_NAME]
        payload = verify_access_token(access_cookie)
        assert payload["sub"] == str(user.id)
        assert payload["type"] == "access"

    async def test_otp_verify_sets_auth_cookies(
        self,
        async_client: AsyncClient,
        create_user: CreateUserCallable,
    ) -> None:
        """OTP verification login sets access_token and refresh_token HTTP-only cookies."""
        user = await create_user(
            username="otp_user",
            email="otp_user@example.com",
            password=None,
            is_email_verified=False,
            otp="654321",
            otp_expires_at=datetime.now(UTC) + timedelta(minutes=10),
        )

        response = await async_client.post(
            "/api-v1/users/otp/verify",
            json={"email": user.email, "otp": "654321"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "OTP verified successfully. Email verified and login granted."
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert "token_type" not in data

        # Check response cookies
        assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

    async def test_protected_route_accessible_via_cookie(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Protected endpoint is accessible using access_token cookie without Authorization header."""
        access_token = create_access_token(user_id=admin_user.id, role=admin_user.role)

        # Send request with Cookie header
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Cookie": f"{settings.ACCESS_TOKEN_COOKIE_NAME}={access_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data

    async def test_get_current_user_profile_via_cookie(
        self,
        async_client: AsyncClient,
        moderator_user: User,
    ) -> None:
        """GET /api-v1/users/me returns authenticated user profile via cookie."""
        access_token = create_access_token(user_id=moderator_user.id, role=moderator_user.role)

        response = await async_client.get(
            "/api-v1/users/me",
            headers={"Cookie": f"{settings.ACCESS_TOKEN_COOKIE_NAME}={access_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == moderator_user.username
        assert data["role"] == "moderator"

    async def test_refresh_token_cookie_rejected_on_protected_route(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Sending a refresh token cookie to a protected endpoint is rejected with 401."""
        refresh_tok, _, _ = create_refresh_token(user_id=admin_user.id)

        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Cookie": f"{settings.ACCESS_TOKEN_COOKIE_NAME}={refresh_tok}"},
        )
        assert response.status_code == 401
        assert "refresh token cannot be used to authenticate" in response.json()["detail"].lower()


class TestRefreshTokenRotationAndRevocation:
    """Tests for refresh token rotation, replay detection, and session revocation."""

    async def test_refresh_token_rotation_success(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Valid refresh token issues new access and rotated refresh tokens, revoking the old one."""
        # Log in user to obtain initial refresh token and register it in Redis
        login_res = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": normal_user.username, "password": "Password123!"},
        )
        assert login_res.status_code == 200
        old_refresh_token = login_res.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        old_payload = decode_jwt_token(old_refresh_token)
        old_jti = old_payload["jti"]

        # Call refresh endpoint using cookie
        refresh_res = await async_client.post(
            "/api-v1/users/refresh",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={old_refresh_token}"},
        )
        assert refresh_res.status_code == 200
        data = refresh_res.json()
        assert data["message"] == "Tokens refreshed successfully."
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert "token_type" not in data

        new_refresh_token = refresh_res.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        new_payload = decode_jwt_token(new_refresh_token)
        new_jti = new_payload["jti"]

        # Verify new token has distinct JTI (rotation)
        assert new_jti != old_jti

        # Verify old token JTI is now recorded as revoked in Redis
        assert await is_refresh_token_revoked(old_jti) is True

    async def test_refresh_token_rotation_via_json_payload(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Refresh token rotation works via request body for programmatic API clients."""
        login_res = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": normal_user.username, "password": "Password123!"},
        )
        refresh_token = login_res.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]

        response = await async_client.post(
            "/api-v1/users/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Tokens refreshed successfully."
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert "token_type" not in data
        assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

    async def test_reuse_of_revoked_token_triggers_full_revocation(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """CRITICAL SECURITY TEST:

        Replaying an already-used/revoked refresh token MUST:
        1. Reject the request with 401.
        2. Detect token theft / reuse.
        3. Invalidate ALL active sessions for that user.
        """
        # Step 1: Initial login
        login_res = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": normal_user.username, "password": "Password123!"},
        )
        token_v1 = login_res.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]

        # Step 2: First rotation (token_v1 -> token_v2)
        rot_res = await async_client.post(
            "/api-v1/users/refresh",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={token_v1}"},
        )
        assert rot_res.status_code == 200
        token_v2 = rot_res.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]

        # Step 3: Malicious actor or replay attempts to use token_v1 again!
        reuse_res = await async_client.post(
            "/api-v1/users/refresh",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={token_v1}"},
        )
        assert reuse_res.status_code == 401
        assert "revoked or already used" in reuse_res.json()["detail"].lower()

        # Step 4: Verify that even token_v2 has now been revoked as a security measure!
        subsequent_res = await async_client.post(
            "/api-v1/users/refresh",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={token_v2}"},
        )
        assert subsequent_res.status_code == 401

    async def test_access_token_rejected_on_refresh_endpoint(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Sending an access token to the refresh endpoint is rejected."""
        access_tok = create_access_token(user_id=normal_user.id, role=normal_user.role)

        response = await async_client.post(
            "/api-v1/users/refresh",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={access_tok}"},
        )
        assert response.status_code == 401
        assert "refresh token is required" in response.json()["detail"].lower()

    async def test_refresh_missing_token_rejected(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Calling refresh with no cookies or payload returns 401."""
        response = await async_client.post("/api-v1/users/refresh")
        assert response.status_code == 401
        assert "refresh token is required" in response.json()["detail"].lower()


class TestUserLogout:
    """Tests for user logout, cookie clearance, and refresh token revocation."""

    async def test_logout_revokes_token_and_clears_cookies(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Logout endpoint clears cookies and revokes refresh token."""
        login_res = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": normal_user.username, "password": "Password123!"},
        )
        refresh_token = login_res.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
        jti = decode_jwt_token(refresh_token)["jti"]

        # Log out
        logout_res = await async_client.post(
            "/api-v1/users/logout",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={refresh_token}"},
        )
        assert logout_res.status_code == 200
        assert logout_res.json()["message"] == "Successfully logged out."

        # Verify refresh token is revoked in Redis
        assert await is_refresh_token_revoked(jti) is True

        # Attempting to refresh with the revoked token must now fail
        refresh_attempt = await async_client.post(
            "/api-v1/users/refresh",
            headers={"Cookie": f"{settings.REFRESH_TOKEN_COOKIE_NAME}={refresh_token}"},
        )
        assert refresh_attempt.status_code == 401
