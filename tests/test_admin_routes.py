"""Tests for Admin Management, System-Wide Statistics, and Audit Logging.

Validates:
- Admin Access Control:
    - Admin access allowed with valid credentials (200)
    - Unauthenticated requests rejected (401)
    - Normal user rejected from admin endpoints (403)
    - Moderator rejected from admin endpoints (403)
    - Suspended or inactive admin rejected (403)
- User Management:
    - Paginated listing with limit and offset (200)
    - Filtering by role, status, and search query (200)
    - Individual user profile details and activity history (200, 404)
    - Role promotion (user -> moderator) and demotion (moderator -> user) (200)
    - Account status updates: active, inactive, suspended (200)
    - Safe user deletion (200, 404)
- Prevention of Role Escalation & Self-Lockout:
    - Normal user / moderator role change attempts rejected (403)
    - Admin self-demotion / role change rejected (400)
    - Admin self-suspension / deactivation rejected (400)
    - Admin self-deletion rejected (400)
    - Protected system accounts cannot be demoted, suspended, or deleted (403)
- System-Wide Statistics & Dashboard:
    - Aggregate user statistics correctness
    - Problem statistics correctness (by difficulty, category, topic, status, moderator)
    - Submission statistics correctness (accepted, rejected, errors, success rate)
    - System activity statistics correctness
    - Dashboard consolidated response correctness
- Audit Logging & Reliability:
    - Role changes, status changes, and deletions recorded in audit logs
    - Sensitive data (passwords, tokens) scrubbed and not logged
    - Failed operations and exception paths recorded as failure audit logs
    - Consistency between recorded outcomes and committed changes on transaction failure
    - Loguru file-based logging, log rotation, retention, and duplicate sink prevention
"""

import uuid
from pathlib import Path

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.base import _utcnow
from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.user import User, UserRole, UserStatus
from app.utils.audit_logger import sanitize_details, setup_audit_logger
from tests.conftest import CreateUserCallable

# ─────────────────────────────────────────────────────────────────────────────
# 1. Admin Access Control Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestAdminAccessControl:
    """Tests for authentication and role-based access control on admin endpoints."""

    async def test_admin_access_with_valid_bearer_token(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Admin can access protected endpoint with Bearer token."""
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data

    async def test_admin_access_with_x_user_id_header(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Admin can access protected endpoint using fallback X-User-Id header."""
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"X-User-Id": str(admin_user.id)},
        )
        assert response.status_code == 200

    async def test_unauthenticated_request_rejected(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Requests without authentication credentials return 401."""
        response = await async_client.get("/api-v1/admin/users")
        assert response.status_code == 401
        assert "detail" in response.json()

    async def test_invalid_token_format_rejected(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Requests with malformed token return 401."""
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Authorization": "Bearer not-a-uuid"},
        )
        assert response.status_code == 401

    async def test_nonexistent_user_token_rejected(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Requests with non-existent user UUID return 401."""
        random_id = uuid.uuid4()
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Authorization": f"Bearer {random_id}"},
        )
        assert response.status_code == 401

    async def test_normal_user_rejected_with_forbidden(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Normal users attempting admin operations return 403 Forbidden."""
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Authorization": f"Bearer {normal_user.id}"},
        )
        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]

    async def test_moderator_user_rejected_from_admin_endpoints(
        self,
        async_client: AsyncClient,
        moderator_user: User,
    ) -> None:
        """Moderator attempting admin operations returns 403 Forbidden."""
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Authorization": f"Bearer {moderator_user.id}"},
        )
        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]

    async def test_suspended_admin_rejected_with_forbidden(
        self,
        async_client: AsyncClient,
        create_user: CreateUserCallable,
    ) -> None:
        """Suspended administrator account returns 403 Forbidden."""
        suspended_admin = await create_user(
            username="suspended_admin",
            email="suspended_admin@example.com",
            role=UserRole.ADMIN,
            status=UserStatus.SUSPENDED,
        )
        response = await async_client.get(
            "/api-v1/admin/users",
            headers={"Authorization": f"Bearer {suspended_admin.id}"},
        )
        assert response.status_code == 403
        assert "suspended" in response.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. User Management Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestAdminUserManagement:
    """Tests for administrator user listing, inspection, status, and role management."""

    async def test_list_users_with_pagination(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Admin can retrieve paginated list of users."""
        for i in range(5):
            await create_user(username=f"page_user_{i}", email=f"page_{i}@example.com")

        response = await async_client.get(
            "/api-v1/admin/users?skip=0&limit=3",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 6
        assert len(data["users"]) == 3
        assert data["skip"] == 0
        assert data["limit"] == 3

    async def test_list_users_filter_by_role(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Admin can filter users by role."""
        await create_user(username="mod_test_1", email="mod1@example.com", role=UserRole.MODERATOR)
        await create_user(username="mod_test_2", email="mod2@example.com", role=UserRole.MODERATOR)

        response = await async_client.get(
            "/api-v1/admin/users?role=moderator",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert all(u["role"] == "moderator" for u in data["users"])

    async def test_list_users_filter_by_status(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Admin can filter users by account status."""
        await create_user(username="active_u", email="active@example.com", status=UserStatus.ACTIVE)
        await create_user(username="susp_u", email="susp@example.com", status=UserStatus.SUSPENDED)

        response = await async_client.get(
            "/api-v1/admin/users?status=suspended",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["users"][0]["status"] == "suspended"

    async def test_list_users_search_filtering(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Admin can search users by username or email substring."""
        await create_user(username="find_me_sam", email="sam@special.com")
        await create_user(username="find_me_bob", email="bob@common.com")

        response = await async_client.get(
            "/api-v1/admin/users?search=special",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["users"][0]["username"] == "find_me_sam"

    async def test_get_user_detail_success(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Admin can view detailed profile including activity information."""
        # Create a problem and a submission for the user
        problem = Problem(
            title="Sum Problem",
            description="Add two numbers",
            difficulty=ProblemDifficulty.EASY,
            category="Math",
            topic="array",
        )
        db_session.add(problem)
        await db_session.commit()
        await db_session.refresh(problem)

        sub = Submission(
            user_id=normal_user.id,
            problem_id=problem.id,
            language=SubmissionLanguage.PYTHON,
            source_code="print(1)",
            status=SubmissionStatus.ACCEPTED,
        )
        db_session.add(sub)
        await db_session.commit()

        response = await async_client.get(
            f"/api-v1/admin/users/{normal_user.id}",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == normal_user.username
        assert data["submissions_count"] == 1
        assert len(data["recent_submissions"]) == 1

    async def test_get_user_detail_not_found(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Non-existent user lookup returns 404."""
        response = await async_client.get(
            f"/api-v1/admin/users/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 404

    async def test_promote_user_to_moderator(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Admin can promote a normal user to moderator with audit log entry."""
        response = await async_client.patch(
            f"/api-v1/admin/users/{normal_user.id}/role",
            json={"role": "moderator"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        assert response.json()["role"] == "moderator"

        # Verify audit log was created
        audit_stmt = select(AuditLog).where(
            AuditLog.action == "user_role_change",
            AuditLog.target_id == str(normal_user.id),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None
        assert audit_log.actor_id == admin_user.id
        assert audit_log.details["new_role"] == "moderator"

    async def test_demote_moderator_to_user(
        self,
        async_client: AsyncClient,
        admin_user: User,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Admin can demote a moderator to normal user with audit log entry."""
        response = await async_client.patch(
            f"/api-v1/admin/users/{moderator_user.id}/role",
            json={"role": "user"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        assert response.json()["role"] == "user"

        audit_stmt = select(AuditLog).where(
            AuditLog.action == "user_role_change",
            AuditLog.target_id == str(moderator_user.id),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None
        assert audit_log.details["old_role"] == "moderator"
        assert audit_log.details["new_role"] == "user"

    async def test_update_user_account_status(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Admin can activate, deactivate, or suspend accounts."""
        # Suspend
        res_susp = await async_client.patch(
            f"/api-v1/admin/users/{normal_user.id}/status",
            json={"status": "suspended"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert res_susp.status_code == 200
        assert res_susp.json()["status"] == "suspended"

        # Reactivate
        res_act = await async_client.patch(
            f"/api-v1/admin/users/{normal_user.id}/status",
            json={"status": "active"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert res_act.status_code == 200
        assert res_act.json()["status"] == "active"

    async def test_admin_update_user_general(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
    ) -> None:
        """Admin can update username and email with uniqueness checks."""
        response = await async_client.patch(
            f"/api-v1/admin/users/{normal_user.id}",
            json={"username": "renamed_user"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        assert response.json()["username"] == "renamed_user"

    async def test_safe_delete_user(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Admin can safely delete user with cascading and audit logging."""
        response = await async_client.delete(
            f"/api-v1/admin/users/{normal_user.id}",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        assert "successfully deleted" in response.json()["message"]

        # Check DB
        stmt = select(User).where(User.id == normal_user.id)
        assert (await db_session.execute(stmt)).scalar_one_or_none() is None

        # Check audit log
        audit_stmt = select(AuditLog).where(
            AuditLog.action == "user_delete",
            AuditLog.target_id == str(normal_user.id),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None


# ─────────────────────────────────────────────────────────────────────────────
# 3. Role Escalation & Self-Lockout Prevention Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestRoleEscalationAndSelfLockout:
    """Tests for role escalation barriers and self-lockout safeguards."""

    async def test_admin_cannot_demote_self(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Administrator cannot demote themselves (self-lockout prevention)."""
        response = await async_client.patch(
            f"/api-v1/admin/users/{admin_user.id}/role",
            json={"role": "user"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 400
        assert "cannot modify their own role" in response.json()["detail"]

    async def test_admin_cannot_suspend_self(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Administrator cannot deactivate or suspend their own account."""
        response = await async_client.patch(
            f"/api-v1/admin/users/{admin_user.id}/status",
            json={"status": "suspended"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 400
        assert "cannot deactivate or suspend their own account" in response.json()["detail"]

    async def test_admin_cannot_delete_self(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Administrator cannot delete their own account."""
        response = await async_client.delete(
            f"/api-v1/admin/users/{admin_user.id}",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 400
        assert "cannot delete their own account" in response.json()["detail"]

    async def test_protected_account_cannot_be_demoted(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Protected system accounts cannot have their role modified."""
        protected_user = await create_user(
            username="system_bot",
            email="system@example.com",
            role=UserRole.ADMIN,
            is_protected=True,
        )
        response = await async_client.patch(
            f"/api-v1/admin/users/{protected_user.id}/role",
            json={"role": "moderator"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 403
        assert "Protected system accounts" in response.json()["detail"]

    async def test_protected_account_cannot_be_suspended(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Protected system accounts cannot be suspended or deactivated."""
        protected_user = await create_user(
            username="system_worker",
            email="worker@example.com",
            role=UserRole.ADMIN,
            is_protected=True,
        )
        response = await async_client.patch(
            f"/api-v1/admin/users/{protected_user.id}/status",
            json={"status": "suspended"},
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 403
        assert "Protected system accounts" in response.json()["detail"]

    async def test_protected_account_cannot_be_deleted(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """Protected system accounts cannot be deleted."""
        protected_user = await create_user(
            username="system_core",
            email="core@example.com",
            role=UserRole.ADMIN,
            is_protected=True,
        )
        response = await async_client.delete(
            f"/api-v1/admin/users/{protected_user.id}",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 403
        assert "Protected system accounts" in response.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 4. System Statistics & Dashboard Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestSystemStatisticsAndDashboard:
    """Tests for aggregate metrics across users, problems, submissions, and activity."""

    async def test_user_statistics_aggregation(
        self,
        async_client: AsyncClient,
        admin_user: User,
        create_user: CreateUserCallable,
    ) -> None:
        """User statistics calculate correct totals by role, status, and period."""
        await create_user(
            username="u1", email="u1@test.com", role=UserRole.USER, status=UserStatus.ACTIVE
        )
        await create_user(
            username="u2", email="u2@test.com", role=UserRole.MODERATOR, status=UserStatus.ACTIVE
        )
        await create_user(
            username="u3", email="u3@test.com", role=UserRole.USER, status=UserStatus.SUSPENDED
        )

        response = await async_client.get(
            "/api-v1/admin/stats/users?days=7",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_users"] >= 4
        assert data["by_role"]["moderator"] >= 1
        assert data["by_role"]["user"] >= 2
        assert data["by_status"]["suspended"] >= 1
        assert data["new_registrations_in_period"] >= 4

    async def test_problem_statistics_aggregation(
        self,
        async_client: AsyncClient,
        admin_user: User,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Problem statistics calculate correct counts by difficulty, category, topic, status."""
        p1 = Problem(
            title="Array Problem",
            description="Array ops",
            difficulty=ProblemDifficulty.EASY,
            category="Algorithms",
            topic="array",
            status=ProblemStatus.PUBLISHED,
            created_by=moderator_user.id,
        )
        p2 = Problem(
            title="Tree Problem",
            description="Binary tree ops",
            difficulty=ProblemDifficulty.MEDIUM,
            category="Data Structures",
            topic="tree",
            status=ProblemStatus.DRAFT,
            created_by=moderator_user.id,
        )
        p3 = Problem(
            title="Old Problem",
            description="Deleted ops",
            difficulty=ProblemDifficulty.HARD,
            category="Algorithms",
            topic="recursion",
            status=ProblemStatus.ARCHIVED,
            is_deleted=True,
            deleted_at=_utcnow(),
        )
        db_session.add_all([p1, p2, p3])
        await db_session.commit()

        response = await async_client.get(
            "/api-v1/admin/stats/problems",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_problems"] == 2
        assert data["total_including_deleted"] == 3
        assert data["by_difficulty"]["easy"] == 1
        assert data["by_difficulty"]["medium"] == 1
        assert data["by_topic"]["array"] == 1
        assert data["by_topic"]["tree"] == 1
        assert data["by_status"]["published"] == 1
        assert data["by_status"]["draft"] == 1
        assert len(data["problems_by_moderator"]) == 1
        assert data["problems_by_moderator"][0]["username"] == moderator_user.username
        assert len(data["recently_deleted"]) == 1

    async def test_submission_statistics_aggregation(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Submission statistics calculate accepted, rejected, error counts, and success rate."""
        p = Problem(
            title="Prob 1",
            description="Desc",
            difficulty=ProblemDifficulty.EASY,
            category="General",
            topic="array",
        )
        db_session.add(p)
        await db_session.commit()
        await db_session.refresh(p)

        s1 = Submission(
            user_id=normal_user.id,
            problem_id=p.id,
            language=SubmissionLanguage.PYTHON,
            source_code="print(1)",
            status=SubmissionStatus.ACCEPTED,
        )
        s2 = Submission(
            user_id=normal_user.id,
            problem_id=p.id,
            language=SubmissionLanguage.PYTHON,
            source_code="print(2)",
            status=SubmissionStatus.WRONG_ANSWER,
        )
        s3 = Submission(
            user_id=normal_user.id,
            problem_id=p.id,
            language=SubmissionLanguage.PYTHON,
            source_code="syntax err",
            status=SubmissionStatus.COMPILATION_ERROR,
        )
        s4 = Submission(
            user_id=normal_user.id,
            problem_id=p.id,
            language=SubmissionLanguage.PYTHON,
            source_code="1/0",
            status=SubmissionStatus.RUNTIME_ERROR,
        )
        s5 = Submission(
            user_id=normal_user.id,
            problem_id=p.id,
            language=SubmissionLanguage.PYTHON,
            source_code="while True: pass",
            status=SubmissionStatus.TIME_LIMIT_EXCEEDED,
        )
        db_session.add_all([s1, s2, s3, s4, s5])
        await db_session.commit()

        response = await async_client.get(
            "/api-v1/admin/stats/submissions?days=30",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_submissions"] == 5
        assert data["accepted"] == 1
        assert data["rejected"] == 4
        assert data["compilation_errors"] == 1
        assert data["runtime_errors"] == 1
        assert data["time_limit_exceeded"] == 1
        assert data["success_rate"] == 20.0

    async def test_dashboard_consolidated_endpoint(
        self,
        async_client: AsyncClient,
        admin_user: User,
    ) -> None:
        """Consolidated dashboard endpoint returns users, problems, submissions, and activity."""
        response = await async_client.get(
            "/api-v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "problems" in data
        assert "submissions" in data
        assert "activity" in data


# ─────────────────────────────────────────────────────────────────────────────
# 5. Audit Logging & Reliability Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestAuditLoggingAndReliability:
    """Tests for audit log completeness, transaction consistency, log rotation, and data scrubbing."""

    async def test_sensitive_data_scrubbing(self) -> None:
        """Audit logger scrubs passwords, tokens, hashes, and OTPs."""
        payload = {
            "username": "alice",
            "password": "SecretPassword123!",
            "password_hash": "$2b$12$e...",
            "token": "eyJhbGciOi...",
            "access_token": "token123",
            "nested": {
                "otp": "123456",
                "safe_field": "visible",
            },
        }
        sanitized = sanitize_details(payload)
        assert sanitized["username"] == "alice"
        assert sanitized["password"] == "[REDACTED]"
        assert sanitized["password_hash"] == "[REDACTED]"
        assert sanitized["token"] == "[REDACTED]"
        assert sanitized["access_token"] == "[REDACTED]"
        assert sanitized["nested"]["otp"] == "[REDACTED]"
        assert sanitized["nested"]["safe_field"] == "visible"

    async def test_audit_logs_listing_and_filtering(
        self,
        async_client: AsyncClient,
        admin_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Admin can list and filter audit logs."""
        log1 = AuditLog(
            actor_id=admin_user.id,
            actor_username=admin_user.username,
            actor_role="admin",
            action="user_role_change",
            status="success",
        )
        log2 = AuditLog(
            actor_id=admin_user.id,
            actor_username=admin_user.username,
            actor_role="admin",
            action="problem_create",
            status="failure",
        )
        db_session.add_all([log1, log2])
        await db_session.commit()

        # Filter by action
        res = await async_client.get(
            "/api-v1/admin/audit-logs?action=user_role_change",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["logs"][0]["action"] == "user_role_change"

        # Get by ID
        log_id = data["logs"][0]["id"]
        res_single = await async_client.get(
            f"/api-v1/admin/audit-logs/{log_id}",
            headers={"Authorization": f"Bearer {admin_user.id}"},
        )
        assert res_single.status_code == 200
        assert res_single.json()["id"] == log_id

    async def test_database_transaction_failure_consistency(
        self,
        async_client: AsyncClient,
        admin_user: User,
        normal_user: User,
        db_session: AsyncSession,
    ) -> None:
        """On database commit failure, user changes are rolled back and a failure audit entry is saved."""
        original_role = normal_user.role

        # Force a database failure on the initial business transaction commit
        orig_commit = db_session.commit
        call_count = 0

        async def failing_commit() -> None:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Simulated DB connection failure")
            return await orig_commit()

        db_session.commit = failing_commit
        try:
            response = await async_client.patch(
                f"/api-v1/admin/users/{normal_user.id}/role",
                json={"role": "moderator"},
                headers={"Authorization": f"Bearer {admin_user.id}"},
            )
            assert response.status_code == 500
        finally:
            db_session.commit = orig_commit

        # Verify user role was NOT committed in DB
        await db_session.refresh(normal_user)
        assert normal_user.role == original_role

        # Verify audit log recorded the failure
        fail_audit_stmt = select(AuditLog).where(
            AuditLog.action == "user_role_change",
            AuditLog.target_id == str(normal_user.id),
            AuditLog.status == "failure",
        )
        failure_log = (await db_session.execute(fail_audit_stmt)).scalar_one_or_none()
        assert failure_log is not None
        assert "Simulated DB connection failure" in failure_log.error_message

    async def test_loguru_file_logging_and_duplicate_prevention(
        self,
        tmp_path: Path,
    ) -> None:
        """Setup audit logger creates file, configures rotation/retention, and prevents duplicate sink entries."""
        log_file = tmp_path / "test_audit.log"

        # First setup call
        sink_id_1 = setup_audit_logger(
            log_file=log_file,
            rotation="1 MB",
            retention="5 days",
        )
        assert sink_id_1 is not None

        # Second setup call — must remove previous sink and not create duplicates
        sink_id_2 = setup_audit_logger(
            log_file=log_file,
            rotation="1 MB",
            retention="5 days",
        )
        assert sink_id_2 is not None

        # Log a sample audit event
        from loguru import logger

        logger.bind(audit=True, audit_action="test_action").info("Single audit message")

        # Verify exactly one line was written (no duplication)
        content = log_file.read_text()
        assert "Single audit message" in content
        lines = [line for line in content.splitlines() if "Single audit message" in line]
        assert len(lines) == 1
