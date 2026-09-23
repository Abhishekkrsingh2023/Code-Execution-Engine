import json
import pathlib
import shutil

import aiofiles
from fastapi import APIRouter, HTTPException
from jinja2 import Template

from app.config import settings
from app.redis_client import get_async_redis_client
from app.schemas.submission import SubmissionRequest, Submission

router = APIRouter(
    prefix="/api-v1/code",
    tags=["code"]
)

redis_client = get_async_redis_client()
PARENT_DIR = pathlib.Path(__file__).parent.parent

language_extension = {
    'python': "py",
    'java':   'java',
    'cpp':    'cpp',
    'c':      'c',
}


@router.post("/submit")
async def submit_code(submission: Submission):
    full_code = Template(submission.main_code).render(user_code=submission.user_code)

    submission_dir = pathlib.Path(f"{PARENT_DIR}/code/{submission.submission_id}")
    file_path = submission_dir / f"Main.{language_extension[submission.language]}"

    # ── Step 1: create the directory ────────────────────────────────────────
    try:
        submission_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error creating code directory: {e}")

    # ── Step 2: write source file to disk before touching Redis ─────────────
    # The worker dequeues immediately after lpush; the file MUST be on disk first.
    try:
        async with aiofiles.open(file_path, 'w') as f:
            await f.write(full_code)
    except Exception as e:
        # Clean up the directory we just created so we don't leave orphans
        shutil.rmtree(submission_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Server error writing source file: {e}")

    # ── Step 3: register the submission in Redis ─────────────────────────────
    submission_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission.submission_id}"
    data_to_store = {
        "submission_id": submission.submission_id,
        "language": submission.language,
        "test_cases": json.dumps([tc.model_dump() for tc in submission.test_cases]),
        "status": "queued",
        "output": "",
        "error": "",
        "results": json.dumps([]),
        "time_taken": 0.0,
    }

    try:
        await redis_client.hset(submission_key, mapping=data_to_store)
        await redis_client.expire(submission_key, 1800)
    except Exception as e:
        # Roll back: remove the file and directory so state is clean
        shutil.rmtree(submission_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Server error registering submission in Redis: {e}")

    # ── Step 4: enqueue the job — LAST, after everything is ready ───────────
    # Placing lpush last ensures the worker always finds the file and Redis
    # hash already in place when it dequeues the job.
    job_payload = submission.model_dump_json(exclude={"user_code", "main_code"})
    try:
        await redis_client.lpush(settings.REDIS_QUEUE_NAME, job_payload)
    except Exception as e:
        # Roll back: delete the Redis key and file so there's no phantom "queued" entry
        await redis_client.delete(submission_key)
        shutil.rmtree(submission_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Server error enqueuing job: {e}")

    return {
        "message": "Submission received successfully.",
        "submission": submission.model_dump(exclude={"user_code", "test_cases", "main_code"}),
    }


@router.get("/submission/poll/{submission_id}")
async def poll_submission(submission_id: str):
    submission_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission_id}"
    submission_data = await redis_client.hgetall(submission_key)

    if not submission_data:
        return {"error": "Submission not found."}

    return submission_data
