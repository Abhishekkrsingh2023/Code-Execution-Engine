"""Tests for user authentication and public profile routes.

This module validates:
- POST /api-v1/users/register:
    - User registration with password (201)
    - Passwordless user registration (201)
    - Duplicate email rejection (409)
    - Duplicate username rejection (409)
    - Input validation failures (422)
- POST /api-v1/users/login:
    - Authentication by username and email (200)
    - Rejection of unverified email accounts (403)
    - Rejection of incorrect password (401)
    - Rejection of non-existent user accounts (401)
    - Rejection of OTP-only (passwordless) accounts attempting password login (401)
- POST /api-v1/users/otp/request and /otp/verify:
    - Requesting a 6-digit OTP for registered users (200)
    - Rejection when requesting OTP for non-existent email (404)
    - Verifying OTP, marking email verified, and completing login (200)
    - Rejection of incorrect OTP (400)
    - Rejection of expired OTP and cleanup (400)
    - Rejection when no OTP is pending (400)
- GET /api-v1/users/username/{username}:
    - Fetching public user profile by unique username handle (200, 404)
- GET /api-v1/users/check-username/{username}:
    - Username availability evaluation
    - Case-insensitive uniqueness check and formatting validation
"""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.utils.jwt import create_access_token
from app.utils.security import verify_password


class TestUserRegister:
    """Test suite for POST /api-v1/users/register."""

    async def test_register_user_with_password_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Valid registration payload with username, email, and password.
        Act: POST to /api-v1/users/register.
        Assert:
        - 201 Created status code.
        - Returns sanitized user profile with is_email_verified=False and has_password=True.
        - Database record contains unverified status and initial 6-digit OTP with expiry.
        """
        payload = {
            "username": "alice_wonderland",
            "email": "alice@example.com",
            "password": "Password123!",
        }

        response = await async_client.post("/api-v1/users/register", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] is None
        assert data["username"] == "alice_wonderland"
        assert data["email"] == "alice@example.com"
        assert data["role"] == "user"
        assert data["is_email_verified"] is False
        assert data["has_password"] is True
        assert "password_hash" not in data
        assert "otp" not in data

        # Verify database record
        user_id = uuid.UUID(data["id"])
        db_user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
        assert db_user.name is None
        assert db_user.username == "alice_wonderland"
        assert db_user.password_hash is not None
        assert db_user.otp is not None
        assert len(db_user.otp) == 6
        assert db_user.otp_expires_at is not None

    async def test_register_user_with_name_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Registration payload including optional name field.
        Act: POST to /api-v1/users/register.
        Assert: 201 Created and name persisted in DB and response.
        """
        payload = {
            "name": "Alice Wonderland",
            "username": "alice_with_name",
            "email": "alice_name@example.com",
            "password": "Password123!",
        }

        response = await async_client.post("/api-v1/users/register", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Alice Wonderland"
        assert data["username"] == "alice_with_name"

        user_id = uuid.UUID(data["id"])
        db_user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
        assert db_user.name == "Alice Wonderland"

    async def test_register_user_passwordless_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Valid registration payload omitting optional password.
        Act: POST to /api-v1/users/register.
        Assert:
        - 201 Created status code.
        - has_password is False.
        - Database record has password_hash=None and OTP generated.
        """
        payload = {
            "username": "bob_builder",
            "email": "bob@example.com",
        }

        response = await async_client.post("/api-v1/users/register", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "bob_builder"
        assert data["has_password"] is False

        user_id = uuid.UUID(data["id"])
        db_user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
        assert db_user.password_hash is None
        assert db_user.otp is not None

    async def test_register_user_duplicate_email_conflict(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user in database.
        Act: POST /api-v1/users/register with identical email but different username.
        Assert: 409 Conflict with detail 'Email is already registered.'.
        """
        await create_user(username="first_user", email="common@example.com")

        payload = {
            "username": "second_user",
            "email": "common@example.com",
            "password": "Password123!",
        }

        response = await async_client.post("/api-v1/users/register", json=payload)

        assert response.status_code == 409
        assert response.json()["detail"] == "Email is already registered."

    async def test_register_user_duplicate_username_conflict(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user in database.
        Act: POST /api-v1/users/register with identical username but different email.
        Assert: 409 Conflict with detail 'Username is already taken.'.
        """
        await create_user(username="taken_handle", email="first@example.com")

        payload = {
            "username": "taken_handle",
            "email": "second@example.com",
            "password": "Password123!",
        }

        response = await async_client.post("/api-v1/users/register", json=payload)

        assert response.status_code == 409
        assert response.json()["detail"] == "Username is already taken."

    @pytest.mark.parametrize(
        "invalid_payload",
        [
            {"username": "ab", "email": "valid@example.com"},  # too short (<3)
            {"username": "bad handle", "email": "valid@example.com"},  # spaces not allowed
            {"username": "alice", "email": "invalid-email"},  # invalid email format
            {
                "username": "alice",
                "email": "valid@example.com",
                "password": "123",
            },  # short password (<6)
        ],
    )
    async def test_register_user_validation_failures(
        self,
        async_client: AsyncClient,
        invalid_payload: dict[str, Any],
    ) -> None:
        """Arrange: Various invalid registration payloads violating Pydantic schema constraints.
        Act: POST /api-v1/users/register.
        Assert: 422 Unprocessable Entity.
        """
        response = await async_client.post("/api-v1/users/register", json=invalid_payload)

        assert response.status_code == 422

    async def test_register_then_verify_otp_flow(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Valid registration payload.
        Act 1: POST /api-v1/users/register.
        Assert 1: 201 Created with is_email_verified=False and OTP in DB.
        Act 2: POST /api-v1/users/otp/verify with issued OTP.
        Assert 2: 200 OK, is_email_verified=True, cookies set.
        Act 3: POST /api-v1/users/login with original password succeeds with 200 OK.
        """
        reg_payload = {
            "username": "verified_flow_user",
            "email": "verified_flow@example.com",
            "password": "SecurePassword123!",
        }

        # 1. Register
        reg_resp = await async_client.post("/api-v1/users/register", json=reg_payload)
        assert reg_resp.status_code == 201
        user_data = reg_resp.json()
        assert user_data["is_email_verified"] is False

        # Retrieve issued OTP from database
        user_id = uuid.UUID(user_data["id"])
        db_user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
        assert db_user.otp is not None
        otp_code = db_user.otp

        # 2. Verify OTP
        verify_payload = {
            "email": "verified_flow@example.com",
            "otp": otp_code,
        }
        verify_resp = await async_client.post("/api-v1/users/otp/verify", json=verify_payload)
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["user"]["is_email_verified"] is True
        assert verify_data["auth_method"] == "otp"

        # 3. Subsequent password login succeeds without 403 Forbidden
        login_payload = {
            "username_or_email": "verified_flow_user",
            "password": "SecurePassword123!",
        }
        login_resp = await async_client.post("/api-v1/users/login", json=login_payload)
        assert login_resp.status_code == 200
        assert login_resp.json()["user"]["is_email_verified"] is True


class TestUserLogin:
    """Test suite for POST /api-v1/users/login."""

    async def test_login_with_valid_username_and_password(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Verified user with known password.
        Act: POST /api-v1/users/login using username handle.
        Assert: 200 OK with login confirmation message, profile, and auth_method='password'.
        """
        await create_user(
            username="clark_kent",
            email="clark@dailyplanet.com",
            password="SuperPassword123!",
            is_email_verified=True,
        )

        payload = {
            "username_or_email": "clark_kent",
            "password": "SuperPassword123!",
        }

        response = await async_client.post("/api-v1/users/login", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Login successful."
        assert data["auth_method"] == "password"
        assert data["user"]["username"] == "clark_kent"
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

    async def test_login_with_valid_email_and_password(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Verified user with known password.
        Act: POST /api-v1/users/login using registered email address.
        Assert: 200 OK with successful authentication.
        """
        await create_user(
            username="diana_prince",
            email="diana@themyscira.gov",
            password="AmazonPassword123!",
            is_email_verified=True,
        )

        payload = {
            "username_or_email": "diana@themyscira.gov",
            "password": "AmazonPassword123!",
        }

        response = await async_client.post("/api-v1/users/login", json=payload)

        assert response.status_code == 200
        assert response.json()["user"]["email"] == "diana@themyscira.gov"

    async def test_login_unverified_email_returns_403(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: User registered with password whose email is NOT verified.
        Act: POST /api-v1/users/login.
        Assert: 403 Forbidden with prompt to verify email via OTP.
        """
        await create_user(
            username="unverified_user",
            email="unverified@example.com",
            password="Password123!",
            is_email_verified=False,
        )

        payload = {
            "username_or_email": "unverified_user",
            "password": "Password123!",
        }

        response = await async_client.post("/api-v1/users/login", json=payload)

        assert response.status_code == 403
        assert "Email address is not verified" in response.json()["detail"]

    async def test_login_wrong_password_returns_401(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Verified user with known password.
        Act: POST /api-v1/users/login with incorrect password.
        Assert: 401 Unauthorized with detail 'Invalid credentials.'.
        """
        await create_user(
            username="secure_user",
            email="secure@example.com",
            password="CorrectPassword123!",
            is_email_verified=True,
        )

        payload = {
            "username_or_email": "secure_user",
            "password": "WrongPassword999!",
        }

        response = await async_client.post("/api-v1/users/login", json=payload)

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials."

    async def test_login_nonexistent_user_returns_401(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: No user registered under the given identifier.
        Act: POST /api-v1/users/login.
        Assert: 401 Unauthorized with generic credential failure.
        """
        payload = {
            "username_or_email": "ghost_user",
            "password": "Password123!",
        }

        response = await async_client.post("/api-v1/users/login", json=payload)

        assert response.status_code == 401

    async def test_login_otp_only_account_with_password_returns_401(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Passwordless user registered without password (password_hash=None).
        Act: POST /api-v1/users/login with arbitrary password.
        Assert: 401 Unauthorized indicating account is configured for OTP login only.
        """
        await create_user(
            username="otp_only_user",
            email="otp_only@example.com",
            password=None,
            is_email_verified=True,
        )

        payload = {
            "username_or_email": "otp_only_user",
            "password": "AnyPassword123!",
        }

        response = await async_client.post("/api-v1/users/login", json=payload)

        assert response.status_code == 401
        assert "account configured for OTP login only" in response.json()["detail"]


class TestUserOTP:
    """Test suite for POST /api-v1/users/otp/request and /api-v1/users/otp/verify."""

    async def test_request_otp_success_updates_user_record(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Registered user in database.
        Act: POST /api-v1/users/otp/request with user's email.
        Assert:
        - 200 OK with confirmation message, email, and 600-second validity.
        - Database user has new 6-digit OTP and future expiration timestamp.
        """
        user = await create_user(username="otp_requester", email="requester@example.com")

        response = await async_client.post(
            "/api-v1/users/otp/request",
            json={"email": "requester@example.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "requester@example.com"
        assert data["expires_in_seconds"] == 600

        # Verify database record updated
        await db_session.refresh(user)
        assert user.otp is not None
        assert len(user.otp) == 6
        assert user.otp_expires_at is not None

    async def test_request_otp_nonexistent_email_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Email not associated with any registered user.
        Act: POST /api-v1/users/otp/request.
        Assert: 404 Not Found.
        """
        response = await async_client.post(
            "/api-v1/users/otp/request",
            json={"email": "unregistered@example.com"},
        )

        assert response.status_code == 404
        assert "No account associated with this email" in response.json()["detail"]

    async def test_verify_otp_success_marks_verified_and_logs_in(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: User with pending valid OTP code and is_email_verified=False.
        Act: POST /api-v1/users/otp/verify with correct OTP.
        Assert:
        - 200 OK with auth_method='otp' and user profile with is_email_verified=True.
        - Database record has is_email_verified=True and OTP consumed (None).
        """
        now = datetime.now(UTC)
        user = await create_user(
            username="otp_verifier",
            email="verifier@example.com",
            is_email_verified=False,
            otp="654321",
            otp_expires_at=now + timedelta(minutes=10),
        )

        payload = {
            "email": "verifier@example.com",
            "otp": "654321",
        }

        response = await async_client.post("/api-v1/users/otp/verify", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["auth_method"] == "otp"
        assert data["user"]["is_email_verified"] is True
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

        # Verify database state
        await db_session.refresh(user)
        assert user.is_email_verified is True
        assert user.otp is None
        assert user.otp_expires_at is None

    async def test_verify_otp_wrong_code_returns_400(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: User with pending OTP '123456'.
        Act: POST /api-v1/users/otp/verify with '999999'.
        Assert: 400 Bad Request with detail 'Invalid OTP code.'.
        """
        now = datetime.now(UTC)
        await create_user(
            username="otp_mismatch",
            email="mismatch@example.com",
            otp="123456",
            otp_expires_at=now + timedelta(minutes=10),
        )

        payload = {
            "email": "mismatch@example.com",
            "otp": "999999",
        }

        response = await async_client.post("/api-v1/users/otp/verify", json=payload)

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid OTP code."

    async def test_verify_otp_expired_code_returns_400_and_resets_otp(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: User with expired OTP code.
        Act: POST /api-v1/users/otp/verify.
        Assert:
        - 400 Bad Request with detail 'OTP code has expired. Please request a new code.'.
        - Database record clears expired OTP.
        """
        past_time = datetime.now(UTC) - timedelta(minutes=5)
        user = await create_user(
            username="expired_user",
            email="expired@example.com",
            otp="112233",
            otp_expires_at=past_time,
        )

        payload = {
            "email": "expired@example.com",
            "otp": "112233",
        }

        response = await async_client.post("/api-v1/users/otp/verify", json=payload)

        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()

        # Verify expired OTP is invalidated
        await db_session.refresh(user)
        assert user.otp is None
        assert user.otp_expires_at is None

    async def test_verify_otp_no_pending_otp_returns_400(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: User without any pending OTP on record (otp=None).
        Act: POST /api-v1/users/otp/verify.
        Assert: 400 Bad Request indicating no pending OTP request found.
        """
        await create_user(
            username="no_otp_user",
            email="no_otp@example.com",
            otp=None,
            otp_expires_at=None,
        )

        payload = {
            "email": "no_otp@example.com",
            "otp": "123456",
        }

        response = await async_client.post("/api-v1/users/otp/verify", json=payload)

        assert response.status_code == 400
        assert "No pending OTP request found" in response.json()["detail"]

    async def test_verify_otp_nonexistent_user_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Email not registered.
        Act: POST /api-v1/users/otp/verify.
        Assert: 404 Not Found.
        """
        payload = {
            "email": "unknown@example.com",
            "otp": "123456",
        }

        response = await async_client.post("/api-v1/users/otp/verify", json=payload)

        assert response.status_code == 404


class TestUserRetrieval:
    """Test suite for GET /api-v1/users/username/{username}."""

    async def test_get_user_by_username_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user in database.
        Act: GET /api-v1/users/username/{username}.
        Assert: 200 OK with user profile details.
        """
        await create_user(username="named_user", email="named@example.com")

        response = await async_client.get("/api-v1/users/username/named_user")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "named_user"
        assert data["email"] == "named@example.com"

    async def test_get_user_by_username_not_found(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Non-existent username.
        Act: GET /api-v1/users/username/ghost_handle.
        Assert: 404 Not Found.
        """
        response = await async_client.get("/api-v1/users/username/ghost_handle")

        assert response.status_code == 404
        assert "ghost_handle" in response.json()["detail"]


class TestUsernameAvailability:
    """Test suite for GET /api-v1/users/check-username/{username}."""

    async def test_check_username_available(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: No user registered with 'fresh_handle'.
        Act: GET /api-v1/users/check-username/fresh_handle.
        Assert: 200 OK with is_available=True and available=True.
        """
        response = await async_client.get("/api-v1/users/check-username/fresh_handle")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "fresh_handle"
        assert data["is_available"] is True
        assert data["available"] is True

    async def test_check_username_taken_case_insensitive(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user with username 'alice_in_chains'.
        Act: GET /api-v1/users/check-username/ALICE_IN_CHAINS.
        Assert: 200 OK with is_available=False (case-insensitive collision check).
        """
        await create_user(username="alice_in_chains", email="chains@example.com")

        response = await async_client.get("/api-v1/users/check-username/ALICE_IN_CHAINS")

        assert response.status_code == 200
        data = response.json()
        assert data["is_available"] is False
        assert data["available"] is False

    async def test_check_username_invalid_format_returns_false(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Username violating format constraints (e.g. contains spaces or special characters).
        Act: GET /api-v1/users/check-username/inv@lid!name.
        Assert: 200 OK with is_available=False.
        """
        response = await async_client.get("/api-v1/users/check-username/inv@lid!name")

        assert response.status_code == 200
        data = response.json()
        assert data["is_available"] is False


class TestUpdateCurrentUserProfile:
    """Test suite for PATCH /api-v1/users/me."""

    async def test_update_name_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Authenticated user with no name set.
        Act: PATCH /api-v1/users/me with new name.
        Assert: 200 OK, name returned and persisted.
        """
        user = await create_user(username="patch_user1", email="patch1@example.com")
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"name": "Alice Wonderland"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Alice Wonderland"
        assert data["username"] == "patch_user1"

        db_user = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
        assert db_user.name == "Alice Wonderland"

    async def test_update_name_to_null_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Authenticated user with existing name.
        Act: PATCH /api-v1/users/me with name=None.
        Assert: 200 OK, name cleared to None.
        """
        user = await create_user(
            name="Alice Wonderland", username="patch_user2", email="patch2@example.com"
        )
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"name": None},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] is None

        db_user = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
        assert db_user.name is None

    async def test_add_new_password_to_passwordless_user(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Authenticated passwordless user (has_password=False).
        Act: PATCH /api-v1/users/me with password.
        Assert: 200 OK, has_password becomes True, user can login with new password.
        """
        user = await create_user(username="otp_user", email="otp_user@example.com", password=None)
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"password": "BrandNewPassword123!"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["has_password"] is True

        db_user = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
        assert db_user.password_hash is not None
        assert verify_password("BrandNewPassword123!", db_user.password_hash)

        # Confirm the user can now login with the new password
        login_res = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": "otp_user", "password": "BrandNewPassword123!"},
        )
        assert login_res.status_code == 200

    async def test_update_existing_password_with_current_password_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Authenticated user with existing password.
        Act: PATCH /api-v1/users/me with correct current_password and new password.
        Assert: 200 OK, password updated.
        """
        user = await create_user(
            username="pwd_user", email="pwd_user@example.com", password="OldPassword123!"
        )
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={
                "current_password": "OldPassword123!",
                "password": "UpdatedPassword456!",
            },
            headers=headers,
        )

        assert response.status_code == 200

        login_res = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": "pwd_user", "password": "UpdatedPassword456!"},
        )
        assert login_res.status_code == 200

    async def test_update_password_with_incorrect_current_password_fails(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Authenticated user with existing password.
        Act: PATCH /api-v1/users/me with WRONG current_password.
        Assert: 400 Bad Request with error detail.
        """
        user = await create_user(
            username="bad_pwd_user", email="bad_pwd@example.com", password="RealPassword123!"
        )
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={
                "current_password": "WrongPassword!",
                "password": "NewPassword789!",
            },
            headers=headers,
        )

        assert response.status_code == 400
        assert "Current password does not match" in response.json()["detail"]

    async def test_update_username_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Authenticated user.
        Act: PATCH /api-v1/users/me with new available username.
        Assert: 200 OK, username updated.
        """
        user = await create_user(username="old_handle", email="old_handle@example.com")
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"username": "new_shiny_handle"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "new_shiny_handle"

        db_user = (await db_session.execute(select(User).where(User.id == user.id))).scalar_one()
        assert db_user.username == "new_shiny_handle"

    async def test_update_username_conflict_fails(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Two users.
        Act: User 1 tries to change username to User 2's username.
        Assert: 409 Conflict.
        """
        await create_user(username="existing_handle", email="existing@example.com")
        user1 = await create_user(username="user_one", email="user_one@example.com")
        token = create_access_token(user_id=user1.id, role=user1.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"username": "existing_handle"},
            headers=headers,
        )

        assert response.status_code == 409
        assert "Username" in response.json()["detail"]

    async def test_update_email_forbidden_fails(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Authenticated user.
        Act: PATCH /api-v1/users/me with email field.
        Assert: 422 Unprocessable Entity (updating email is forbidden).
        """
        user = await create_user(username="email_user", email="old_email@example.com")
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"email": "new_email@example.com"},
            headers=headers,
        )

        assert response.status_code == 422

    async def test_update_user_unauthenticated_fails(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: No auth cookies or header.
        Act: PATCH /api-v1/users/me.
        Assert: 401 Unauthorized.
        """
        response = await async_client.patch(
            "/api-v1/users/me",
            json={"name": "Ghost Name"},
        )

        assert response.status_code == 401

    async def test_update_user_forbidden_fields_fails(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Authenticated normal user.
        Act: Try to inject role='admin'.
        Assert: 422 Unprocessable Entity (extra fields forbidden).
        """
        user = await create_user(username="role_hacker", email="hacker@example.com")
        token = create_access_token(user_id=user.id, role=user.role)
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.patch(
            "/api-v1/users/me",
            json={"role": "admin"},
            headers=headers,
        )

        assert response.status_code == 422
