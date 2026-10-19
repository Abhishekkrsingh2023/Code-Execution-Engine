import asyncio
import shutil
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import aiofiles
import orjson
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.problem import Problem
from app.models.problem_template import CommonProblemTemplate
from app.models.submission import Submission, SubmissionLanguage, SubmissionStatus
from app.models.test_case import TestCase as TestCaseModel
from app.models.user import User
from app.redis_client import get_async_redis_client
from app.schemas.submission import ExecutionMode, SubmissionRequest, TestCase
from app.services.leaderboard_service import record_submission_completion, resolve_problem_id

redis_client = get_async_redis_client()

language_extension = {
    "python": "py",
    "java": "java",
    "javascript": "js",
    "cpp": "cpp",
    "c": "c",
}


async def load_problem_test_cases(
    problem_id_val: int | str,
    mode: str,
    db: AsyncSession | None,
) -> tuple[list[TestCase], float | None, str | None]:
    """Loads internal test cases for a problem from the database.

    For submit mode: fetches hidden/evaluation test cases (is_sample=False or submit_test_cases).
    For run mode: fetches sample test cases (is_sample=True or run_test_cases).
    """
    if db is None:
        return [], None, None

    cleaned = str(problem_id_val).strip()
    problem: Problem | None = None

    if cleaned.isdigit():
        stmt = select(Problem).where(Problem.id == int(cleaned), Problem.is_deleted.is_(False))
        problem = (await db.execute(stmt)).scalar_one_or_none()

    if problem is None:
        stmt = select(Problem).where(Problem.title.ilike(cleaned), Problem.is_deleted.is_(False))
        problem = (await db.execute(stmt)).scalars().first()

    code_id = problem.id if problem else (int(cleaned) if cleaned.isdigit() else None)
    common_tmpl = None
    if code_id is not None:
        stmt_common = select(CommonProblemTemplate).where(
            CommonProblemTemplate.problem_id == code_id
        )
        common_tmpl = (await db.execute(stmt_common)).scalar_one_or_none()

    if not common_tmpl and problem:
        # NOTE: Description-based matching (problem_statement == problem.description) has been
        # intentionally removed. It caused: (1) wrong test cases if descriptions were similar,
        # and (2) a full-table seq scan on every submit. Enforce FK integrity via problem_id instead.
        logger.warning(
            "CommonProblemTemplate not found for problem_id={}. No fuzzy fallback will be attempted.",
            code_id,
        )

    raw_cases: list[dict] = []
    if mode == "submit":
        if problem:
            stmt_tcs = select(TestCaseModel).where(TestCaseModel.problem_id == problem.id)
            db_tcs = (await db.execute(stmt_tcs)).scalars().all()
            hidden_tcs = [tc for tc in db_tcs if not tc.is_sample]
            if hidden_tcs:
                raw_cases = [
                    {
                        "id": tc.id,
                        "input": tc.input,
                        "expected_output": tc.expected_output,
                        "weight": tc.weight,
                    }
                    for tc in hidden_tcs
                ]
            elif db_tcs:
                raw_cases = [
                    {
                        "id": tc.id,
                        "input": tc.input,
                        "expected_output": tc.expected_output,
                        "weight": tc.weight,
                    }
                    for tc in db_tcs
                ]
        if not raw_cases and common_tmpl:
            if common_tmpl.submit_test_cases:
                raw_cases = list(common_tmpl.submit_test_cases)
            elif common_tmpl.run_test_cases:
                raw_cases = list(common_tmpl.run_test_cases)
    else:  # mode == "run"
        if problem:
            stmt_tcs = select(TestCaseModel).where(TestCaseModel.problem_id == problem.id)
            db_tcs = (await db.execute(stmt_tcs)).scalars().all()
            sample_tcs = [tc for tc in db_tcs if tc.is_sample]
            if sample_tcs:
                raw_cases = [
                    {
                        "id": tc.id,
                        "input": tc.input,
                        "expected_output": tc.expected_output,
                        "weight": tc.weight,
                    }
                    for tc in sample_tcs
                ]
            elif db_tcs:
                raw_cases = [
                    {
                        "id": tc.id,
                        "input": tc.input,
                        "expected_output": tc.expected_output,
                        "weight": tc.weight,
                    }
                    for tc in db_tcs
                ]
        if not raw_cases and common_tmpl:
            if common_tmpl.run_test_cases:
                raw_cases = list(common_tmpl.run_test_cases)
            elif common_tmpl.submit_test_cases:
                raw_cases = list(common_tmpl.submit_test_cases)

    test_cases = [
        TestCase(
            id=int(rc["id"]) if rc.get("id") is not None and str(rc["id"]).isdigit() else None,
            input=str(rc.get("input", "")),
            expected_output=str(rc.get("expected_output", "")),
            weight=float(rc.get("weight", 1.0) or 1.0),
        )
        for rc in raw_cases
    ]
    time_limit = (
        problem.time_limit if problem else (common_tmpl.time_limit if common_tmpl else None)
    )
    problem_name = problem.title if problem else None
    return test_cases, time_limit, problem_name


async def handle_code_execution_request(
    submission: SubmissionRequest,
    mode: str = "submit",
    current_user: User | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    submission.mode = ExecutionMode(mode)

    # 1. Resolve test cases based on mode
    if mode == "submit":
        internal_cases, prob_time_limit, resolved_name = await load_problem_test_cases(
            submission.problem_id, mode="submit", db=db
        )
        if internal_cases:
            submission.test_cases = internal_cases
            if prob_time_limit and submission.time_limit == 2.0:
                submission.time_limit = prob_time_limit
            if resolved_name and (
                not submission.problem_name or submission.problem_name == "Problem Submission"
            ):
                submission.problem_name = resolved_name
        elif not submission.test_cases:
            raise HTTPException(
                status_code=404,
                detail=f"Problem '{submission.problem_id}' not found or has no internal test cases configured.",
            )
    else:  # mode == "run"
        if not submission.test_cases:
            raise HTTPException(
                status_code=400,
                detail="No test cases provided.",
            )

    ext = language_extension.get(submission.language)
    submission_dir = settings.resolve_code_dir() / submission.submission_id
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

    # Pre-create or persist Submission in PostgreSQL ONLY for submit mode
    if db is not None and mode == "submit":
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
                    "mode": mode,
                    "user_id": str(target_user_id) if target_user_id else "",
                    "problem_id": str(submission.problem_id),
                    "problem_name": str(submission.problem_name or "Problem Submission"),
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
            "Queued {} {} ({}) user_id={}",
            mode,
            submission.submission_id,
            submission.language,
            target_user_id,
        )

    except Exception as exc:
        logger.exception("Failed to enqueue submission {}", submission.submission_id)
        await asyncio.to_thread(shutil.rmtree, submission_dir, True)  # True = ignore_errors
        raise HTTPException(status_code=500, detail="Failed to enqueue submission") from exc

    return {
        "message": "Submission received successfully."
        if mode == "submit"
        else "Run request received successfully.",
        "submission": submission.submission_id,
        "status": "queued",
        "mode": mode,
        "streaming_url": f"/api-v1/code/stream/{submission.submission_id}",
        "polling_url": f"/api-v1/code/submission/poll/{submission.submission_id}",
    }


async def handle_submit_code_request(
    submission: SubmissionRequest,
    current_user: User | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """Entry point for the /submit endpoint.

    Always forces mode='submit' regardless of what the incoming schema says,
    preventing clients from bypassing leaderboard updates by injecting mode='run'.
    """
    return await handle_code_execution_request(
        submission=submission,
        mode="submit",  # hardcoded — never trust client-supplied mode on submit endpoint
        current_user=current_user,
        db=db,
    )


async def handle_run_code_request(
    submission: SubmissionRequest,
    current_user: User | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    submission.mode = ExecutionMode.run
    return await handle_code_execution_request(
        submission=submission,
        mode="run",
        current_user=current_user,
        db=db,
    )


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

    mode = submission_data.get("mode", "submit")

    # If the submission finished judging, ensure DB & leaderboard sync ONLY for submit mode
    if mode == "submit" and submission_data.get("status") in ("completed", "failed", "tle"):
        try:
            await record_submission_completion(submission_id, submission_data, db=db)
        except Exception as exc:
            logger.warning("DB sync on poll failed for submission {}: {}", submission_id, exc)

    # For submit mode: never expose raw internal test cases in polling output
    if mode == "submit":
        clean_data = dict(submission_data)
        clean_data.pop("test_cases", None)
        return clean_data

    return submission_data
