import pathlib
import shutil
import sys
import time
from enum import Enum

import orjson  # faster JSON serialization/deserialization than the built-in json module
import redis

# Ensure worker package and directory are importable regardless of invocation directory
_CURRENT_DIR = pathlib.Path(__file__).parent.resolve()
_PARENT_DIR = _CURRENT_DIR.parent.resolve()
for _p in (_PARENT_DIR, _CURRENT_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from worker.config import settings
    from worker.container import DockerContainerEngine
    from worker.database import engine
    from worker.logs.logger import logger as log
    from worker.logs.logger import setup_logging
    from worker.services import record_submission_completion
except ImportError:
    # pyrefly: ignore[missing-import]
    # pyrefly: ignore[missing-import]
    from config import settings

    # pyrefly: ignore[missing-import]
    from container import DockerContainerEngine

    # pyrefly: ignore[missing-import]
    from database import engine

    # pyrefly: ignore[missing-import]
    from logs.logger import logger as log

    # pyrefly: ignore[missing-import]
    from logs.logger import setup_logging

    # pyrefly: ignore[missing-import]
    from services import record_submission_completion

if settings.LOG_FILE_PATH:
    setup_logging(
        log_file=settings.LOG_FILE_PATH,
        rotation=settings.LOG_ROTATION,
        retention=settings.LOG_RETENTION,
        level=settings.LOG_LEVEL,
    )
else:
    setup_logging(
        rotation=settings.LOG_ROTATION,
        retention=settings.LOG_RETENTION,
        level=settings.LOG_LEVEL,
    )

# ── Constants ────────────────────────────────────────────────────────────────


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TLE = "tle"  # Time Limit Exceeded


QUEUE_NAME = settings.REDIS_QUEUE_NAME
SUBMISSION_KEY = settings.REDIS_SUBMISSION_KEY_PREFIX

# Docker image for each supported language
DOCKER_IMAGE = settings.docker_images

# Host-side base directory for code submissions
CODE_BASE = settings.resolve_code_base(_PARENT_DIR)

# How long to try reconnecting to Redis before giving up (seconds)
REDIS_RECONNECT_DELAY = settings.REDIS_RECONNECT_DELAY

EXTENSION_MAP = {
    "python": "py",
    "cpp": "cpp",
    "c": "c",
    "java": "java",
}


# ── Redis factory ────────────────────────────────────────────────────────────


def _make_redis_client() -> redis.Redis:
    """Create a synchronous Redis client with sane timeouts and keepalive."""
    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
        socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
        socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
        socket_keepalive=True,
    )


# ── Job helpers ──────────────────────────────────────────────────────────────


def extract_submission_data(job: str) -> dict:
    """Parse the JSON job string from the Redis queue.

    Returns a dict with: submission_id, mode, test_cases, time_limit, language,
    user_id, problem_id, problem_name, user_code.
    """
    job_data = orjson.loads(job)
    return {
        "submission_id": job_data.get("submission_id"),
        "mode": job_data.get("mode", "submit"),
        "language": job_data.get("language"),
        "test_cases": job_data.get("test_cases", []),
        "time_limit": job_data.get("time_limit", 2.0),
        "user_id": job_data.get("user_id"),
        "problem_id": job_data.get("problem_id"),
        "problem_name": job_data.get("problem_name"),
        "user_code": job_data.get("user_code", ""),
    }


def compile_and_run_code(submission_data: dict) -> dict:
    """Spin up a Docker container, compile (if needed), run each test case,

    calculate score based on passed tests, then destroy the container.

    Container teardown is guaranteed via ``try/finally`` even when compilation
    fails.

    Returns a result dict suitable for direct storage in Redis via hset.
    """
    submission_id = submission_data["submission_id"]
    language = submission_data["language"]
    test_cases = submission_data.get("test_cases") or []
    time_limit = float(submission_data.get("time_limit") or 2.0)
    user_code = submission_data.get("user_code", "")
    max_score = round(sum(float(tc.get("weight", 1.0) or 1.0) for tc in test_cases), 2)

    # Ensure code file exists in submission directory in case worker runs independently
    submission_dir = CODE_BASE / submission_id
    submission_dir.mkdir(parents=True, exist_ok=True)
    ext = EXTENSION_MAP.get(language, "txt")
    code_file = submission_dir / f"Main.{ext}"
    if not code_file.exists() and user_code:
        code_file.write_text(user_code, encoding="utf-8")

    # Add a small grace period on top of declared limit so Docker exec overhead doesn't count against user
    exec_timeout = time_limit + 2.0

    mount_path = settings.HOST_CODE_BASE_DIR or str(CODE_BASE)
    container = DockerContainerEngine(
        image_name=DOCKER_IMAGE[language],
        memory_limit=settings.CONTAINER_MEMORY_LIMIT,
        cpu_limit=settings.CONTAINER_CPU_LIMIT,
        pids_limit=settings.CONTAINER_PIDS_LIMIT,
        volume_mount=mount_path,
    )

    try:
        # ── Start container ──────────────────────────────────────────────
        try:
            container.start_container(folder_name=submission_id)
        except Exception as e:
            raise RuntimeError(f"Failed to start Docker container: {e}") from e

        # ── Compile (no-op for interpreted languages) ────────────────────
        compile_result = container.compile_code(language, folder_name=submission_id)
        if not compile_result["compiled"]:
            return {
                "status": JobStatus.FAILED.value,
                "output": compile_result["stdout"],
                "error": compile_result["stderr"],
                "results": orjson.dumps([]),
                "time_taken": 0.0,
                "score": 0.0,
                "max_score": max_score,
                "tests_passed": 0,
                "total_tests": len(test_cases),
            }

        # ── Execute each test case ───────────────────────────────────────
        start_time = time.perf_counter()
        results = []
        overall_status = JobStatus.COMPLETED
        score = 0.0
        tests_passed = 0

        for test_case in test_cases:
            input_data = test_case.get("input", "")
            expected_output = test_case.get("expected_output", "")
            weight = float(test_case.get("weight", 1.0) or 1.0)

            execution_result = container.execute_code(
                language,
                input_data,
                folder_name=submission_id,
                timeout=exec_timeout,
            )

            if execution_result["returncode"] == 124:
                # Time Limit Exceeded — mark and continue so all test cases are reported
                results.append(
                    {
                        "status": "tle",
                        "output": "",
                        "error": "Time Limit Exceeded",
                        "weight": weight,
                        "score": 0.0,
                    }
                )
                overall_status = JobStatus.TLE
            elif (
                execution_result["returncode"] == 0
                and execution_result["stdout"].strip() == expected_output.strip()
            ):
                score += weight
                tests_passed += 1
                results.append(
                    {
                        "status": "passed",
                        "output": execution_result["stdout"],
                        "error": "",
                        "weight": weight,
                        "score": weight,
                    }
                )
            else:
                results.append(
                    {
                        "status": "failed",
                        "output": execution_result["stdout"],
                        "error": execution_result["stderr"],
                        "weight": weight,
                        "score": 0.0,
                    }
                )
                if overall_status != JobStatus.TLE:
                    overall_status = JobStatus.FAILED

        mode = submission_data.get("mode", "submit")
        if mode == "submit":
            sanitized_results = [
                {
                    "test_case": idx + 1,
                    "status": r["status"],
                    "weight": r.get("weight", 1.0),
                    "score": r.get("score", 0.0),
                }
                for idx, r in enumerate(results)
            ]
            final_results = sanitized_results
        else:
            final_results = results

        total_time = time.perf_counter() - start_time

        return {
            "status": overall_status.value,
            "output": ""
            if mode == "submit"
            else "\n".join(r.get("output", "") for r in results if r.get("output")),
            "error": ""
            if mode == "submit"
            else "\n".join(r.get("error", "") for r in results if r.get("error")),
            "results": orjson.dumps(final_results),
            "time_taken": round(total_time, 4),
            "score": round(score, 2),
            "max_score": max_score,
            "tests_passed": tests_passed,
            "total_tests": len(test_cases),
        }

    finally:
        # Always remove container — prevents zombie container leaks
        try:
            container.remove_container()
        except Exception as e:
            log.error("Failed to remove container for {}: {}", submission_id, e)


# ── Main processing loop ─────────────────────────────────────────────────────


def process_jobs(client: redis.Redis) -> None:
    """Inner loop: dequeue jobs synchronously and process them until a Redis error occurs."""
    log.info("Worker ready — waiting for jobs on '{}'", QUEUE_NAME)

    while True:
        result = client.brpop(QUEUE_NAME, timeout=30)
        if result is None:
            # Timeout — no jobs yet; loop to issue another brpop
            continue

        _, job = result
        data = extract_submission_data(job)
        submission_id = data["submission_id"]
        mode = data.get("mode", "submit")
        submission_key = f"{SUBMISSION_KEY}{submission_id}"

        log.info(
            "Processing submission {} (mode={}, lang={})", submission_id, mode, data["language"]
        )

        # Mark the submission as running so pollers can distinguish
        # "waiting in queue" from "actively being judged"
        client.hset(submission_key, "status", JobStatus.RUNNING.value)

        try:
            results = compile_and_run_code(data)
        except Exception as e:
            log.exception("Unhandled error for submission {}", submission_id)
            results = {
                "status": JobStatus.FAILED.value,
                "output": "",
                "error": str(e),
                "results": orjson.dumps([]),
                "time_taken": 0.0,
                "score": 0.0,
                "max_score": 0.0,
                "tests_passed": 0,
                "total_tests": len(data.get("test_cases", [])),
            }

        # Persist results back to Redis
        client.hset(submission_key, mapping=results)
        if mode == "submit":
            client.hdel(submission_key, "test_cases")

        # Build payload matching polling endpoint's response shape
        result_dict = client.hgetall(submission_key)
        if not result_dict:
            result_dict = {
                "submission_id": submission_id,
                "mode": mode,
                "language": data.get("language"),
                **results,
            }
        if mode == "submit":
            result_dict.pop("test_cases", None)

        payload = orjson.dumps(result_dict)
        client.set(f"result:{submission_id}", payload, ex=3600)  # durable copy, 1h TTL
        client.publish(f"result:{submission_id}", payload)  # live notification

        # Synchronize score and submission record to PostgreSQL & update user leaderboard ONLY for submit mode
        if mode == "submit":
            try:
                full_data = {**data, **results}
                record_submission_completion(submission_id, full_data)
                log.info(
                    "Persisted submission {} to PostgreSQL and updated user leaderboard score",
                    submission_id,
                )
            except Exception as exc:
                log.warning("Could not sync submission {} to database: {}", submission_id, exc)
        # else:
        #     log.info(
        #         "Submission {} in 'run' mode: marks and leaderboard NOT updated", submission_id
        #     ) # no need to log

        # Clean up the submission's source directory from disk
        submission_dir = CODE_BASE / submission_id
        try:
            shutil.rmtree(submission_dir)
        except FileNotFoundError:
            pass  # already removed — benign
        except Exception as e:
            log.error("Cleanup failed for {}: {}", submission_id, e)

        log.info(
            "Finished submission {} — status={}, score={}/{}",
            submission_id,
            results["status"],
            results.get("score"),
            results.get("max_score"),
        )


def main() -> None:
    """Outer loop: connect to Redis and start processing jobs synchronously.

    Reconnects automatically if the connection is lost.
    """
    try:
        while True:
            try:
                client = _make_redis_client()
                client.ping()  # fail fast if Redis is not reachable at startup
                process_jobs(client)
            except redis.ConnectionError as e:
                log.error(
                    "Redis connection lost: {} — reconnecting in {}s…", e, REDIS_RECONNECT_DELAY
                )
                time.sleep(REDIS_RECONNECT_DELAY)
            except redis.TimeoutError as e:
                log.error("Redis timeout: {} — reconnecting in {}s…", e, REDIS_RECONNECT_DELAY)
                time.sleep(REDIS_RECONNECT_DELAY)
            except KeyboardInterrupt:
                log.info("Worker shutting down.")
                break
    finally:
        try:
            engine.dispose()
        except Exception as e:
            log.error("Error disposing database engine: {}", e)


if __name__ == "__main__":
    main()
