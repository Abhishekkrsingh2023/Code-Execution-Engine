import json
import pathlib
import shutil
import time
import logging
from enum import Enum

import redis

from .container import DockerContainerEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    QUEUED    = "queued"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    TLE       = "tle"  # Time Limit Exceeded

QUEUE_NAME      = "code:queue"
SUBMISSION_KEY  = "submission:"

# docker image for each supported language
# NOTE: there is no official "java:*" image on Docker Hub — use eclipse-temurin.
DOCKER_IMAGE = {
    "python": "python:3.12-alpine",
    "cpp":    "gcc:12.5",
    "c":      "gcc:12.5",
    "java":   "eclipse-temurin:22-jdk-alpine",
}

# Host-side base directory; the worker appends /{submission_id} when mounting
PATH = pathlib.Path(__file__).parent.parent.resolve()
CODE_BASE = PATH / "app" / "code"

# How long to try reconnecting to Redis before giving up (seconds)
REDIS_RECONNECT_DELAY = 5


# ── Redis factory ────────────────────────────────────────────────────────────

def _make_redis_client() -> redis.Redis:
    """
    Create a Redis client with sane timeouts and keepalive.

    ``socket_timeout=None`` (the original default) would stall the worker
    forever if Redis becomes unresponsive.  We set an explicit timeout and
    rely on the reconnect loop in ``main()`` to re-establish the connection.
    """
    return redis.Redis(
        host="localhost",
        port=6379,
        decode_responses=True,
        socket_timeout=30,           # raise after 30 s of silence
        socket_connect_timeout=10,   # fail fast on initial connect
        socket_keepalive=True,       # OS-level TCP keepalive (detects dropped conns)
        retry_on_timeout=True,
    )


# ── Job helpers ──────────────────────────────────────────────────────────────

def extract_submission_data(job: str) -> dict:
    """
    Parse the JSON job string from the Redis queue.

    Returns a dict with: submission_id, test_cases, time_limit, language.
    """
    job_data = json.loads(job)
    return {
        "submission_id": job_data.get("submission_id"),
        "language":      job_data.get("language"),
        "test_cases":    job_data.get("test_cases"),
        "time_limit":    job_data.get("time_limit", 2.0),
    }


def compile_and_run_code(submission_data: dict) -> dict:
    """
    Spin up a Docker container, compile (if needed), run each test case,
    then destroy the container.

    Container teardown is guaranteed via ``try/finally`` even when compilation
    fails — previously, a compile failure left zombie containers running.

    Returns a result dict suitable for direct storage in Redis via hset.
    """
    submission_id = submission_data["submission_id"]
    language      = submission_data["language"]
    test_cases    = submission_data["test_cases"]
    time_limit    = float(submission_data.get("time_limit") or 2.0)

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
            raise RuntimeError(f"Failed to start Docker container: {e}")

        # ── Compile (no-op for interpreted languages) ────────────────────
        compile_result = container.compile_code(language, folder_name=submission_id)
        if not compile_result["compiled"]:
            return {
                "status":     JobStatus.FAILED.value,
                "output":     compile_result["stdout"],
                "error":      compile_result["stderr"],
                "results":    json.dumps([]),
                "time_taken": 0.0,
            }

        # ── Execute each test case ───────────────────────────────────────
        start_time = time.perf_counter()
        results = []
        overall_status = JobStatus.COMPLETED

        for test_case in test_cases:
            input_data      = test_case.get("input", "")
            expected_output = test_case.get("expected_output", "")

            execution_result = container.execute_code(
                language,
                input_data,
                folder_name=submission_id,
                timeout=exec_timeout,
            )

            if execution_result["returncode"] == 124:
                # Time Limit Exceeded — mark and continue so all test cases are reported
                results.append({
                    "status": "tle",
                    "output": "",
                    "error":  "Time Limit Exceeded",
                })
                overall_status = JobStatus.TLE
            elif execution_result["returncode"] == 0 and \
                    execution_result["stdout"].strip() == expected_output.strip():
                results.append({
                    "status": "passed",
                    "output": execution_result["stdout"],
                    "error":  "",
                })
            else:
                results.append({
                    "status": "failed",
                    "output": execution_result["stdout"],
                    "error":  execution_result["stderr"],
                })

        total_time = time.perf_counter() - start_time

        return {
            "status":     overall_status.value,
            "output":     "",
            "error":      "",
            "results":    json.dumps(results),
            "time_taken": round(total_time, 4),
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
        submission_key = f"{SUBMISSION_KEY}{submission_id}"

        log.info("Processing submission %s (lang=%s)", submission_id, data["language"])

        # Mark the submission as running so pollers can distinguish
        # "waiting in queue" from "actively being judged"
        client.hset(submission_key, "status", JobStatus.RUNNING.value)

        try:
            results = compile_and_run_code(data)
        except Exception as e:
            log.exception("Unhandled error for submission %s", submission_id)
            results = {
                "status":     JobStatus.FAILED.value,
                "output":     "",
                "error":      str(e),
                "results":    json.dumps([]),   # ← always present so callers don't get KeyError
                "time_taken": 0.0,
            }

        # Persist results back to Redis
        client.hset(submission_key, mapping=results)

        # Clean up the submission's source directory from disk
        submission_dir = CODE_BASE / submission_id
        try:
            shutil.rmtree(submission_dir)
        except FileNotFoundError:
            pass  # already removed — benign
        except Exception as e:
            log.error("Cleanup failed for %s: %s", submission_id, e)

        log.info("Finished submission %s — status=%s", submission_id, results["status"])


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