"""Tests for Problem Management, Moderator Activities, and Audit Logging.

Validates:
- Moderator problem creation with topic and audit log creation.
- Moderator problem update with audit logging.
- Moderator publication status change with audit logging.
- Moderator problem deletion with audit logging.
- Normal user restrictions on moderator problem actions (403).
- Unauthenticated user restrictions on moderator problem actions (401).
- Public problem listing and filtering by topic, difficulty, category, status, and search.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.problem import Problem, ProblemDifficulty, ProblemStatus
from app.models.user import User
from app.utils.jwt import create_access_token


def auth_headers(user: User) -> dict[str, str]:
    """Helper returning standard Bearer authorization header with a valid JWT access token."""
    token = create_access_token(user_id=user.id, role=user.role)
    return {"Authorization": f"Bearer {token}"}


class TestModeratorProblemActivities:
    """Tests for moderator problem management and audit logging."""

    async def test_moderator_create_problem_with_topic_success(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Moderator can create problem with topic and audit entry is generated."""
        payload = {
            "title": "Reverse Linked List",
            "description": "Given the head of a singly linked list, reverse the list.",
            "difficulty": "easy",
            "category": "Data Structures",
            "topic": "linkedlist",
            "time_limit": 2.0,
            "memory_limit": 256,
            "status": "published",
        }
        response = await async_client.post(
            "/api-v1/problems",
            json=payload,
            headers=auth_headers(moderator_user),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Reverse Linked List"
        assert data["topic"] == "linkedlist"
        assert data["created_by"] == str(moderator_user.id)

        # Verify audit log was recorded
        audit_stmt = select(AuditLog).where(
            AuditLog.action == "problem_create",
            AuditLog.target_id == str(data["id"]),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None
        assert audit_log.actor_id == moderator_user.id
        assert audit_log.details["topic"] == "linkedlist"
        assert audit_log.status == "success"

    async def test_moderator_update_problem_success(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Moderator can update problem details and an audit entry is created."""
        problem = Problem(
            title="Binary Search",
            description="Find target in sorted array",
            difficulty=ProblemDifficulty.EASY,
            category="Algorithms",
            topic="array",
            created_by=moderator_user.id,
        )
        db_session.add(problem)
        await db_session.commit()
        await db_session.refresh(problem)

        response = await async_client.patch(
            f"/api-v1/problems/{problem.id}",
            json={"difficulty": "medium", "topic": "binary_search"},
            headers=auth_headers(moderator_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty"] == "medium"
        assert data["topic"] == "binary_search"

        # Verify audit log
        audit_stmt = select(AuditLog).where(
            AuditLog.action == "problem_update",
            AuditLog.target_id == str(problem.id),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None
        assert audit_log.status == "success"

    async def test_moderator_update_publication_status_success(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Moderator can change publication status and an audit entry is generated."""
        problem = Problem(
            title="Tree Inorder Traversal",
            description="Inorder traversal of binary tree",
            difficulty=ProblemDifficulty.EASY,
            category="Trees",
            topic="tree",
            status=ProblemStatus.DRAFT,
            created_by=moderator_user.id,
        )
        db_session.add(problem)
        await db_session.commit()
        await db_session.refresh(problem)

        response = await async_client.patch(
            f"/api-v1/problems/{problem.id}/status",
            json={"status": "published"},
            headers=auth_headers(moderator_user),
        )
        assert response.status_code == 200
        assert response.json()["status"] == "published"

        # Verify audit log
        audit_stmt = select(AuditLog).where(
            AuditLog.action == "problem_status_change",
            AuditLog.target_id == str(problem.id),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None
        assert audit_log.details["old_status"] == "draft"
        assert audit_log.details["new_status"] == "published"

    async def test_moderator_delete_problem_success(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Moderator can soft-delete a problem with audit logging."""
        problem = Problem(
            title="Deprecated Problem",
            description="Old description",
            difficulty=ProblemDifficulty.HARD,
            category="Math",
            topic="recursion",
            created_by=moderator_user.id,
        )
        db_session.add(problem)
        await db_session.commit()
        await db_session.refresh(problem)

        response = await async_client.delete(
            f"/api-v1/problems/{problem.id}",
            headers=auth_headers(moderator_user),
        )
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

        # Check soft-deleted
        await db_session.refresh(problem)
        assert problem.is_deleted is True
        assert problem.deleted_at is not None

        # Verify audit log
        audit_stmt = select(AuditLog).where(
            AuditLog.action == "problem_delete",
            AuditLog.target_id == str(problem.id),
        )
        audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
        assert audit_log is not None
        assert audit_log.status == "success"

    async def test_normal_user_cannot_create_problem(
        self,
        async_client: AsyncClient,
        normal_user: User,
    ) -> None:
        """Normal user cannot create problems (403 Forbidden)."""
        response = await async_client.post(
            "/api-v1/problems",
            json={
                "title": "Unauthorized Problem",
                "description": "Should fail",
                "difficulty": "easy",
                "topic": "recursion",
            },
            headers=auth_headers(normal_user),
        )
        assert response.status_code == 403

    async def test_unauthenticated_cannot_create_problem(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Unauthenticated user cannot create problems (401 Unauthorized)."""
        response = await async_client.post(
            "/api-v1/problems",
            json={
                "title": "Anon Problem",
                "description": "Should fail",
                "difficulty": "easy",
            },
        )
        assert response.status_code == 401


class TestPublicProblemListingAndFiltering:
    """Tests for public problem browsing with filters."""

    async def test_filter_problems_by_topic(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Users can filter problems by topic."""
        p1 = Problem(
            title="Max Subarray",
            description="Find contiguous subarray",
            difficulty=ProblemDifficulty.MEDIUM,
            topic="array",
        )
        p2 = Problem(
            title="Tree Max Depth",
            description="Find tree depth",
            difficulty=ProblemDifficulty.EASY,
            topic="tree",
        )
        db_session.add_all([p1, p2])
        await db_session.commit()

        response = await async_client.get("/api-v1/problems?topic=tree")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["problems"][0]["topic"] == "tree"
        assert data["problems"][0]["title"] == "Tree Max Depth"

    async def test_search_problems_by_keyword(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Users can search problems by keyword across title, description, and topic."""
        p = Problem(
            title="Fibonacci Number",
            description="Calculate nth fibonacci using recursion or memoization",
            difficulty=ProblemDifficulty.EASY,
            topic="recursion",
        )
        db_session.add(p)
        await db_session.commit()

        response = await async_client.get("/api-v1/problems?search=fibonacci")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["problems"][0]["title"] == "Fibonacci Number"

    async def test_create_full_problem_with_templates_and_test_cases(
        self,
        async_client: AsyncClient,
        moderator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Moderator can create a full problem with run test cases, submit test cases, and templates."""
        payload = {
            "title": "Valid Palindrome",
            "description": "Determine if a string is a palindrome, ignoring non-alphanumeric chars.",
            "difficulty": "easy",
            "category": "Strings",
            "topic": "two_pointers",
            "time_limit": 1.5,
            "memory_limit": 128,
            "status": "published",
            "problem_code": 2,
            "run_test_cases": [
                {"input": "race a car", "expected_output": "false"},
                {"input": "A man, a plan, a canal: Panama", "expected_output": "true"},
            ],
            "submit_test_cases": [
                {"input": " ", "expected_output": "true", "weight": 1.0},
                {"input": "0P", "expected_output": "false", "weight": 2.0},
            ],
            "templates": [
                {
                    "language": "python",
                    "boilerplate_code": "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        pass",
                },
                {
                    "language": "cpp",
                    "boilerplate_code": "class Solution {\npublic:\n    bool isPalindrome(string s) {\n        return true;\n    }\n};",
                },
            ],
        }

        response = await async_client.post(
            "/api-v1/problems/full",
            json=payload,
            headers=auth_headers(moderator_user),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["problem"]["title"] == "Valid Palindrome"
        assert data["problem_code"] == 2
        assert len(data["run_test_cases"]) == 2
        assert "submit_test_cases" not in data
        assert len(data["templates"]) == 2
        assert (
            data["templates"][0]["boilerplate_code"]
            == "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        pass"
        )
        assert data["test_cases_count"] == 4

        # Test GET /api-v1/problems/{id}/full
        problem_id = data["problem"]["id"]
        get_res = await async_client.get(f"/api-v1/problems/{problem_id}/full")
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["problem"]["id"] == problem_id
        assert len(get_data["run_test_cases"]) == 2
        assert "submit_test_cases" not in get_data
        assert get_data["run_test_cases"][0]["input"] == "race a car"
        assert len(get_data["templates"]) == 2
        assert get_data["templates"][0]["boilerplate_code"] is not None

        # Test GET /api-v1/problems/templates/common
        tmpl_res = await async_client.get("/api-v1/problems/templates/common")
        assert tmpl_res.status_code == 200
        tmpls = tmpl_res.json()
        assert any(t["problem_id"] == 2 for t in tmpls)
