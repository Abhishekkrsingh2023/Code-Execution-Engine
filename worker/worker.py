import asyncio
import logging
import pathlib
import shutil
import sys
import time
from enum import Enum

import orjson  # faster JSON serialization/deserialization than the built-in json module
import redis

# pyrefly: ignore[missing-import]
from container import DockerContainerEngine

# Ensure app package is importable
PATH = pathlib.Path(__file__).parent.parent.resolve()
if str(PATH) not in sys.path:
    sys.path.insert(0, str(PATH))

from app.config import settings  # noqa: E402
from app.services.leaderboard_service import record_submission_completion  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TLE = "tle"  # Time Limit Exceeded


QUEUE_NAME = "code:queue"
SUBMISSION_KEY = "submission:"

# docker image for each supported language
# NOTE: there is no official "java:*" image on Docker Hub — use eclipse-temurin.
DOCKER_IMAGE = {
    "python": "python:3.12-alpine",
    "cpp": "gcc:12.5",
    "c": "gcc:12.5",
    "java": "eclipse-temurin:22-jdk-alpine",
}

# Host-side base directory; the worker appends /{submission_id} when mounting
CODE_BASE = PATH / "app" / "code"

# How long to try reconnecting to Redis before giving up (seconds)
REDIS_RECONNECT_DELAY = 5


# ── Redis factory ────────────────────────────────────────────────────────────


def _make_redis_client() -> redis.Redis:
    """
    Create a Redis client with sane timeouts and keepalive.

    Uses host/port from app.config.settings so the worker respects the same
    environment variables as the FastAPI application. Previously this was
    hardcoded to localhost:6379 which broke Docker Compose / Kubernetes setups.
    """
    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=True,
        socket_timeout=30,  # raise after 30 s of silence
        socket_connect_timeout=10,  # fail fast on initial connect
        socket_keepalive=True,  # OS-level TCP keepalive (detects dropped conns)
    )


# ── Job helpers ──────────────────────────────────────────────────────────────


def extract_submission_data(job: str) -> dict:
    """
    Parse the JSON job string from the Redis queue.

    Returns a dict with: submission_id, mode, test_cases, time_limit, language, user_id, problem_id, problem_name.
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
    """
    Spin up a Docker container, compile (if needed), run each test case,
    calculate score based on passed tests, then destroy the container.

    Container teardown is guaranteed via ``try/finally`` even when compilation
    fails — previously, a compile failure left zombie containers running.

    Returns a result dict suitable for direct storage in Redis via hset.
    """
    submission_id = submission_data["submission_id"]
    language = submission_data["language"]
    test_cases = submission_data.get("test_cases") or []
    time_limit = float(submission_data.get("time_limit") or 2.0)
    max_score = round(sum(float(tc.get("weight", 1.0) or 1.0) for tc in test_cases), 2)

    # Add a small grace period on top of the declared limit so Docker exec
    # overhead doesn't count against the user's allotted time.
    exec_timeout = time_limit + 2.0

    container = DockerContainerEngine(
        image_name=DOCKER_IMAGE[language],
        memory_limit="128m",
        cpu_limit="0.5",
        volume_mount=str(CODE_BASE),
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
        # Always remove the container — even when compilation fails or an
        # unhandled exception propagates. Prevents zombie container leaks.
        try:
            container.remove_container()
        except Exception as e:
            log.error("Failed to remove container for %s: %s", submission_id, e)


# ── Main processing loop ─────────────────────────────────────────────────────


def process_jobs(client: redis.Redis) -> None:
    """
    Inner loop: dequeue jobs and process them until a Redis error occurs.
    Separated from ``main()`` so the reconnect wrapper in ``main()`` can
    cleanly restart it without restarting the whole process.
    """
    log.info("Worker ready — waiting for jobs on '%s'", QUEUE_NAME)

    while True:
        # brpop with timeout=30 so the loop wakes up periodically and can
        # detect a stale connection sooner than socket_timeout alone.
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
            "Processing submission %s (mode=%s, lang=%s)", submission_id, mode, data["language"]
        )

        # Mark the submission as running so pollers can distinguish
        # "waiting in queue" from "actively being judged"
        client.hset(submission_key, "status", JobStatus.RUNNING.value)

        try:
            results = compile_and_run_code(data)
        except Exception as e:
            log.exception("Unhandled error for submission %s", submission_id)
            results = {
                "status": JobStatus.FAILED.value,
                "output": "",
                "error": str(e),
                "results": orjson.dumps([]),  # ← always present so callers don't get KeyError
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

        # Build payload matching the polling endpoint's response shape
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
                asyncio.run(record_submission_completion(submission_id, full_data))
                log.info(
                    "Persisted submission %s to PostgreSQL and updated user leaderboard score",
                    submission_id,
                )
            except Exception as exc:
                log.warning("Could not sync submission %s to database: %s", submission_id, exc)
        else:
            log.info(
                "Submission %s in 'run' mode: marks and leaderboard NOT updated", submission_id
            )

        # Clean up the submission's source directory from disk
        submission_dir = CODE_BASE / submission_id
        try:
            shutil.rmtree(submission_dir)
        except FileNotFoundError:
            pass  # already removed — benign
        except Exception as e:
            log.error("Cleanup failed for %s: %s", submission_id, e)

        log.info(
            "Finished submission %s — status=%s, score=%s/%s",
            submission_id,
            results["status"],
            results.get("score"),
            results.get("max_score"),
        )


def main() -> None:
    """
    Outer loop: connect to Redis and start processing jobs.
    Reconnects automatically if the connection is lost.
    """
    while True:
        try:
            client = _make_redis_client()
            client.ping()  # fail fast if Redis is not reachable at startup
            process_jobs(client)
        except redis.ConnectionError as e:
            log.error("Redis connection lost: %s — reconnecting in %ds…", e, REDIS_RECONNECT_DELAY)
            time.sleep(REDIS_RECONNECT_DELAY)
        except redis.TimeoutError as e:
            log.error("Redis timeout: %s — reconnecting in %ds…", e, REDIS_RECONNECT_DELAY)
            time.sleep(REDIS_RECONNECT_DELAY)
        except KeyboardInterrupt:
            log.info("Worker shutting down.")
            break


if __name__ == "__main__":
    main()
