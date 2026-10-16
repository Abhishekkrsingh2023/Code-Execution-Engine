import asyncio
import pathlib
import shutil
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import aiofiles
import orjson
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.user import User
from app.redis_client import get_async_redis_client
from app.schemas.submission import SubmissionRequest
from app.services.leaderboard_service import record_submission_completion, resolve_problem_id

redis_client = get_async_redis_client()
PARENT_DIR = pathlib.Path(__file__).parent.parent

language_extension = {
    "python": "py",
    "java": "java",
    "javascript": "js",
    "cpp": "cpp",
    "c": "c",
}


async def handle_submit_code_request(
    submission: SubmissionRequest,
    current_user: User | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    ext = language_extension.get(submission.language)

    submission_dir = pathlib.Path(PARENT_DIR) / "code" / submission.submission_id
    file_path = submission_dir / f"Main.{ext}"
    submission_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission.submission_id}"

    # Determine user identity if present
    target_user_id: uuid.UUID | None = None
    if current_user is not None:
        target_user_id = current_user.id
        submission.user_id = str(current_user.id)
    elif submission.user_id:
        try:
            target_user_id = uuid.UUID(str(submission.user_id))
        except (ValueError, TypeError):
            target_user_id = None

    max_possible_score = round(sum(float(tc.weight) for tc in submission.test_cases), 2)

    # Pre-create or persist Submission in PostgreSQL if database session is provided
    if db is not None:
        try:
            sub_uuid = uuid.UUID(submission.submission_id)
            resolved_prob_id = await resolve_problem_id(submission.problem_id, db)
            db_sub = Submission(
                id=sub_uuid,
                user_id=target_user_id,
                problem_id=resolved_prob_id,
                problem_name=submission.problem_name,
                language=SubmissionLanguage(submission.language),
                source_code=submission.user_code,
                status=SubmissionStatus.QUEUED,
                score=0.0,
                max_score=max_possible_score,
                tests_passed=0,
                total_tests=len(submission.test_cases),
            )
            db.add(db_sub)
            await db.commit()
            logger.info(
                "Persisted initial queued submission #{} for user={}", sub_uuid, target_user_id
            )
        except Exception as db_exc:
            await db.rollback()
            logger.warning(
                "Could not pre-persist submission {} in DB: {}", submission.submission_id, db_exc
            )

    try:
        # ── Disk first: the worker must find the file when it pops the job ──
        submission_dir.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
            await f.write(submission.user_code)

        # ── Redis: one round trip, atomic (all commands apply or none) ──────
        async with redis_client.pipeline(transaction=True) as pipe:
            pipe.hset(
                submission_key,
                mapping={
                    "submission_id": submission.submission_id,
                    "user_id": str(target_user_id) if target_user_id else "",
                    "problem_id": str(submission.problem_id),
                    "problem_name": str(submission.problem_name),
                    "language": submission.language,
                    "test_cases": orjson.dumps([tc.model_dump() for tc in submission.test_cases]),
                    "status": "queued",
                    "output": "",
                    "error": "",
                    "results": orjson.dumps([]),
                    "time_taken": 0.0,
                    "score": 0.0,
                    "max_score": max_possible_score,
                    "tests_passed": 0,
                    "total_tests": len(submission.test_cases),
                },
            )
            pipe.expire(submission_key, 1800)
            pipe.lpush(settings.REDIS_QUEUE_NAME, submission.model_dump_json())
            await pipe.execute()

        logger.info(
            "Queued submission {} ({}) user_id={}",
            submission.submission_id,
            submission.language,
            target_user_id,
        )

    except Exception as exc:
        logger.exception("Failed to enqueue submission {}", submission.submission_id)
        await asyncio.to_thread(shutil.rmtree, submission_dir, True)  # True = ignore_errors
        raise HTTPException(status_code=500, detail="Failed to enqueue submission") from exc

    return {
        "message": "Submission received successfully.",
        "submission": submission.submission_id,
        "status": "queued",
        "streaming_url": f"/api-v1/code/stream/{submission.submission_id}",
        "polling_url": f"/api-v1/code/submission/poll/{submission.submission_id}",
    }


async def handle_stream_submission(submission_id: uuid.UUID) -> StreamingResponse:
    async def event_generator() -> AsyncGenerator[str]:
        channel = f"result:{submission_id}"
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel)  # 1. subscribe FIRST
        try:
            saved = await redis_client.get(channel)  # 2. then check stored result
            if saved:
                yield f"event: result\ndata: {saved}\n\n"
                return
            while True:  # 3. then wait for publish
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15)
                if msg is None or msg.get("type") != "message":
                    yield ": keepalive\n\n"
                    continue
                yield f"event: result\ndata: {msg['data']}\n\n"
                return  # 4. close after result
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                pass
            try:
                if hasattr(pubsub, "aclose"):
                    await pubsub.aclose()
                else:
                    await pubsub.close()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def handle_poll_submission(
    submission_id: str,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    submission_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission_id}"
    submission_data = await redis_client.hgetall(submission_key)

    if not submission_data:
        raise HTTPException(status_code=404, detail="Submission not found.")

    # If the submission finished judging, ensure DB & leaderboard sync
    if submission_data.get("status") in ("completed", "failed", "tle"):
        try:
            await record_submission_completion(submission_id, submission_data, db=db)
        except Exception as exc:
            logger.debug("DB sync on poll: {}", exc)

    return submission_data
