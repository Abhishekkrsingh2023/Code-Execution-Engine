"""Tests for user management and authentication routes.

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
- GET /api-v1/users/:
    - Paginated listing with limit and offset (200)
    - Role-based filtering (user, admin, moderator) (200)
- GET /api-v1/users/{user_id} and /username/{username}:
    - Fetching user profiles by UUID primary key (200, 404, 422)
    - Fetching user profiles by unique username handle (200, 404)
- GET /api-v1/users/check-username:
    - Username availability evaluation via path and query string
    - Case-insensitive uniqueness check and formatting validation
- PATCH /api-v1/users/{user_id}:
    - Updating username, email, password, role, and verification status (200)
    - Collision prevention on modified username or email (409)
    - Safe handling when keeping same username (200)
- DELETE /api-v1/users/{user_id}:
    - Deleting an existing user account (200)
    - Attempting to delete a non-existent user account (404)
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Callable

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


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
        assert db_user.username == "alice_wonderland"
        assert db_user.password_hash is not None
        assert db_user.otp is not None
        assert len(db_user.otp) == 6
        assert db_user.otp_expires_at is not None

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
            {"username": "alice", "email": "valid@example.com", "password": "123"},  # short password (<6)
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


class TestUserRetrievalAndListing:
    """Test suite for GET /api-v1/users/, /api-v1/users/{id}, and /api-v1/users/username/{username}."""

    async def test_list_users_pagination(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: 5 users created in the database.
        Act: GET /api-v1/users/?skip=1&limit=2.
        Assert:
        - 200 OK with total=5, skip=1, limit=2.
        - users list contains exactly 2 users.
        """
        for i in range(5):
            await create_user(username=f"user_page_{i}", email=f"page_{i}@example.com")

        response = await async_client.get("/api-v1/users/?skip=1&limit=2")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["skip"] == 1
        assert data["limit"] == 2
        assert len(data["users"]) == 2

    async def test_list_users_filter_by_role(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: 2 regular users and 1 admin user in database.
        Act: GET /api-v1/users/?role=admin.
        Assert:
        - 200 OK with total=1.
        - All returned users have role='admin'.
        """
        await create_user(username="standard_1", email="u1@example.com", role=UserRole.USER)
        await create_user(username="standard_2", email="u2@example.com", role=UserRole.USER)
        await create_user(username="site_admin", email="admin@example.com", role=UserRole.ADMIN)

        response = await async_client.get("/api-v1/users/?role=admin")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["users"]) == 1
        assert data["users"][0]["username"] == "site_admin"
        assert data["users"][0]["role"] == "admin"

    async def test_get_user_by_id_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user in database.
        Act: GET /api-v1/users/{user_id}.
        Assert: 200 OK with user profile details.
        """
        user = await create_user(username="target_user", email="target@example.com")

        response = await async_client.get(f"/api-v1/users/{user.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(user.id)
        assert data["username"] == "target_user"

    async def test_get_user_by_id_not_found(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Random non-existent UUID.
        Act: GET /api-v1/users/{random_uuid}.
        Assert: 404 Not Found.
        """
        non_existent_id = uuid.uuid4()
        response = await async_client.get(f"/api-v1/users/{non_existent_id}")

        assert response.status_code == 404
        assert f"User with ID '{non_existent_id}' not found." in response.json()["detail"]

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
    """Test suite for GET /api-v1/users/check-username/{username} and query parameter variant."""

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

    async def test_check_username_via_query_parameter(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Desired username passed via query parameter.
        Act: GET /api-v1/users/check-username?username=cool_dev.
        Assert: 200 OK with evaluated availability flags.
        """
        response = await async_client.get("/api-v1/users/check-username?username=cool_dev")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "cool_dev"
        assert data["is_available"] is True


class TestUserUpdate:
    """Test suite for PATCH /api-v1/users/{user_id}."""

    async def test_update_user_fields_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user in database.
        Act: PATCH /api-v1/users/{user_id} with new username, email, and role.
        Assert: 200 OK returning updated user profile.
        """
        user = await create_user(
            username="old_username",
            email="old_email@example.com",
            role=UserRole.USER,
        )

        payload = {
            "username": "new_username",
            "email": "new_email@example.com",
            "role": "moderator",
        }

        response = await async_client.patch(f"/api-v1/users/{user.id}", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "new_username"
        assert data["email"] == "new_email@example.com"
        assert data["role"] == "moderator"

    async def test_update_user_password_and_verify_new_login(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user with verified email and initial password.
        Act:
        1. PATCH /api-v1/users/{user_id} with new password.
        2. POST /api-v1/users/login with new password.
        Assert:
        - PATCH returns 200 OK.
        - Login with new password succeeds (200 OK).
        - Login with old password fails (401 Unauthorized).
        """
        user = await create_user(
            username="change_pwd_user",
            email="pwd@example.com",
            password="OldPassword123!",
            is_email_verified=True,
        )

        patch_response = await async_client.patch(
            f"/api-v1/users/{user.id}",
            json={"password": "NewPassword456!"},
        )
        assert patch_response.status_code == 200

        # Login with old password should fail
        fail_login = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": "change_pwd_user", "password": "OldPassword123!"},
        )
        assert fail_login.status_code == 401

        # Login with new password should succeed
        success_login = await async_client.post(
            "/api-v1/users/login",
            json={"username_or_email": "change_pwd_user", "password": "NewPassword456!"},
        )
        assert success_login.status_code == 200

    async def test_update_user_username_collision_returns_409(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Two distinct users in database.
        Act: PATCH user1 to have user2's username.
        Assert: 409 Conflict.
        """
        user1 = await create_user(username="user_one", email="one@example.com")
        await create_user(username="user_two", email="two@example.com")

        response = await async_client.patch(
            f"/api-v1/users/{user1.id}",
            json={"username": "user_two"},
        )

        assert response.status_code == 409
        assert "Username 'user_two' is already taken." in response.json()["detail"]

    async def test_update_user_email_collision_returns_409(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Two distinct users in database.
        Act: PATCH user1 to have user2's email.
        Assert: 409 Conflict.
        """
        user1 = await create_user(username="user_alpha", email="alpha@example.com")
        await create_user(username="user_beta", email="beta@example.com")

        response = await async_client.patch(
            f"/api-v1/users/{user1.id}",
            json={"email": "beta@example.com"},
        )

        assert response.status_code == 409
        assert "Email 'beta@example.com' is already registered." in response.json()["detail"]

    async def test_update_user_same_username_no_collision(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
    ) -> None:
        """Arrange: Existing user in database.
        Act: PATCH user with their existing username unchanged.
        Assert: 200 OK without triggering conflict check.
        """
        user = await create_user(username="unchanged_user", email="unchanged@example.com")

        response = await async_client.patch(
            f"/api-v1/users/{user.id}",
            json={"username": "unchanged_user"},
        )

        assert response.status_code == 200
        assert response.json()["username"] == "unchanged_user"

    async def test_update_user_not_found(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Non-existent user UUID.
        Act: PATCH /api-v1/users/{random_uuid}.
        Assert: 404 Not Found.
        """
        non_existent_id = uuid.uuid4()
        response = await async_client.patch(
            f"/api-v1/users/{non_existent_id}",
            json={"username": "new_handle"},
        )

        assert response.status_code == 404


class TestUserDeletion:
    """Test suite for DELETE /api-v1/users/{user_id}."""

    async def test_delete_user_success(
        self,
        async_client: AsyncClient,
        create_user: Callable[..., Any],
        db_session: AsyncSession,
    ) -> None:
        """Arrange: Existing user in database.
        Act: DELETE /api-v1/users/{user_id}.
        Assert:
        - 200 OK with success message.
        - User is removed from database.
        """
        user = await create_user(username="delete_me", email="delete_me@example.com")

        response = await async_client.delete(f"/api-v1/users/{user.id}")

        assert response.status_code == 200
        assert "was successfully deleted" in response.json()["message"]

        # Verify removal from database
        check = await db_session.execute(select(User).where(User.id == user.id))
        assert check.scalar_one_or_none() is None

    async def test_delete_user_not_found(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Arrange: Non-existent user UUID.
        Act: DELETE /api-v1/users/{random_uuid}.
        Assert: 404 Not Found.
        """
        non_existent_id = uuid.uuid4()
        response = await async_client.delete(f"/api-v1/users/{non_existent_id}")

        assert response.status_code == 404
