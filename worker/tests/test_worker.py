import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

try:
    from worker.config import WorkerSettings
    from worker.config import settings as worker_settings
    from worker.container import DockerContainerEngine
    from worker.models import Problem, Submission, SubmissionStatus, User
    from worker.services import (
        map_job_status_to_submission_status,
        record_submission_completion,
        resolve_problem_id,
        update_user_leaderboard_score,
    )
    from worker.worker import extract_submission_data
except (ImportError, ModuleNotFoundError):
    from config import WorkerSettings
    from config import settings as worker_settings
    from container import DockerContainerEngine
    from models import Problem, Submission, SubmissionStatus, User
    from services import (
        map_job_status_to_submission_status,
        record_submission_completion,
        resolve_problem_id,
        update_user_leaderboard_score,
    )
    from worker import extract_submission_data

# Use sync engine pointing to the test database
TEST_SYNC_DB_URL = worker_settings.sync_database_url.replace("/code_buddy", "/code_buddy_test")
sync_test_engine = create_engine(TEST_SYNC_DB_URL, echo=False)


@pytest.fixture
def sync_db() -> Session:
    """Fixture providing a synchronous SQLAlchemy session against the test DB."""
    session = Session(sync_test_engine)
    try:
        yield session
    finally:
        session.rollback()
        # Cleanup
        session.query(Submission).delete()
        session.query(Problem).delete()
        session.query(User).delete()
        session.commit()
        session.close()


def test_worker_settings():
    ws = WorkerSettings(
        DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/code_buddy",
        REDIS_HOST="custom_redis",
        REDIS_PORT=6380,
    )
    assert ws.REDIS_HOST == "custom_redis"
    assert ws.REDIS_PORT == 6380
    assert (
        ws.sync_database_url == "postgresql+psycopg://postgres:password@localhost:5432/code_buddy"
    )
    assert "python" in ws.docker_images
    assert "cpp" in ws.docker_images


def test_resolve_code_base():
    ws = WorkerSettings()
    resolved = ws.resolve_code_base()
    assert resolved.exists()
    assert resolved.name == "code"
    assert resolved.parent.name == "backend"


def test_resolve_code_base_custom(tmp_path):
    custom_dir = tmp_path / "custom_code"
    ws = WorkerSettings(CODE_BASE_DIR=str(custom_dir))
    resolved = ws.resolve_code_base()
    assert resolved == custom_dir.resolve()
    assert resolved.exists()


def test_extract_submission_data():
    job_json = (
        '{"submission_id": "sub-123", "language": "python", "user_code": "print(1)", '
        '"test_cases": [{"input": "1", "expected_output": "1"}], "time_limit": 1.5, '
        '"user_id": "u-456", "problem_id": 1, "problem_name": "Test Prob"}'
    )
    data = extract_submission_data(job_json)
    assert data["submission_id"] == "sub-123"
    assert data["language"] == "python"
    assert data["user_code"] == "print(1)"
    assert len(data["test_cases"]) == 1
    assert data["time_limit"] == 1.5
    assert data["user_id"] == "u-456"
    assert data["problem_id"] == 1
    assert data["problem_name"] == "Test Prob"
    assert data["mode"] == "submit"


def test_map_job_status_to_submission_status():
    assert (
        map_job_status_to_submission_status("completed", tests_passed=2, total_tests=2)
        == SubmissionStatus.ACCEPTED
    )
    assert (
        map_job_status_to_submission_status("completed", tests_passed=1, total_tests=2)
        == SubmissionStatus.WRONG_ANSWER
    )
    assert (
        map_job_status_to_submission_status("tle", tests_passed=0, total_tests=1)
        == SubmissionStatus.TIME_LIMIT_EXCEEDED
    )
    assert (
        map_job_status_to_submission_status("compilation_error", tests_passed=0, total_tests=1)
        == SubmissionStatus.COMPILATION_ERROR
    )
    assert (
        map_job_status_to_submission_status("runtime_error", tests_passed=0, total_tests=1)
        == SubmissionStatus.RUNTIME_ERROR
    )
    assert (
        map_job_status_to_submission_status("failed", tests_passed=1, total_tests=2)
        == SubmissionStatus.WRONG_ANSWER
    )
    assert (
        map_job_status_to_submission_status("failed", tests_passed=0, total_tests=0)
        == SubmissionStatus.INTERNAL_ERROR
    )


def test_resolve_problem_id(sync_db: Session):
    problem = Problem(
        title="Sample Problem",
        description="A sample problem description.",
        is_deleted=False,
    )
    sync_db.add(problem)
    sync_db.commit()
    sync_db.refresh(problem)

    # By ID
    assert resolve_problem_id(problem.id, sync_db) == problem.id
    # By string ID
    assert resolve_problem_id(str(problem.id), sync_db) == problem.id
    # By title
    assert resolve_problem_id("Sample Problem", sync_db) == problem.id
    # None
    assert resolve_problem_id(None, sync_db) is None
    # Non-existent
    assert resolve_problem_id(999999, sync_db) is None


def test_sync_record_submission_completion(sync_db: Session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        username="sync_worker_user",
        email="sync_worker@example.com",
        total_score=0.0,
        problems_solved=0,
    )
    sync_db.add(user)
    sync_db.commit()

    sub_id = uuid.uuid4()
    result_data = {
        "status": "completed",
        "score": 10.0,
        "max_score": 10.0,
        "tests_passed": 2,
        "total_tests": 2,
        "time_taken": 0.05,
        "user_id": str(user_id),
        "problem_id": None,
        "problem_name": "Adhoc Problem 1",
        "language": "python",
        "user_code": "print('hello')",
    }

    res = record_submission_completion(sub_id, result_data, db=sync_db)
    assert res["status"] == "accepted"
    assert res["score"] == 10.0
    assert res["user_total_score"] == 10.0
    assert res["user_problems_solved"] == 1

    # Verify directly from database
    updated_user = sync_db.query(User).filter_by(id=user_id).one()
    assert updated_user.total_score == 10.0
    assert updated_user.problems_solved == 1

    sub_row = sync_db.query(Submission).filter_by(id=sub_id).one()
    assert sub_row.status == SubmissionStatus.ACCEPTED
    assert sub_row.score == 10.0


def test_update_user_leaderboard_score_best_score(sync_db: Session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        username="best_score_user",
        email="best_score@example.com",
        total_score=0.0,
        problems_solved=0,
    )
    sync_db.add(user)

    prob = Problem(
        title="Scored Problem",
        description="Scored problem description.",
        is_deleted=False,
    )
    sync_db.add(prob)
    sync_db.commit()

    # Two submissions for same problem: first gets 5, second gets 10
    sub1 = Submission(
        id=uuid.uuid4(),
        user_id=user_id,
        problem_id=prob.id,
        problem_name="Scored Problem",
        language="python",
        source_code="pass",
        status=SubmissionStatus.WRONG_ANSWER,
        score=5.0,
        max_score=10.0,
        tests_passed=1,
        total_tests=2,
    )
    sub2 = Submission(
        id=uuid.uuid4(),
        user_id=user_id,
        problem_id=prob.id,
        problem_name="Scored Problem",
        language="python",
        source_code="pass",
        status=SubmissionStatus.ACCEPTED,
        score=10.0,
        max_score=10.0,
        tests_passed=2,
        total_tests=2,
    )
    sync_db.add_all([sub1, sub2])
    sync_db.commit()

    total_score, solved = update_user_leaderboard_score(user_id, sync_db)
    assert total_score == 10.0  # takes the max, not 15
    assert solved == 1


def test_docker_container_engine_init():
    engine = DockerContainerEngine(
        image_name="python:3.12-alpine",
        volume_mount="/tmp/test",
        memory_limit="64m",
        cpu_limit="0.25",
        pids_limit=30,
    )
    assert engine.image_name == "python:3.12-alpine"
    assert engine.volume_mount == "/tmp/test"
    assert engine.memory_limit == "64m"
    assert engine.cpu_limit == "0.25"
    assert engine.pids_limit == 30
