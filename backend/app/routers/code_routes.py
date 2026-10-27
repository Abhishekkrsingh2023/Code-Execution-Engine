import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.code_controller import (
    handle_poll_submission,
    handle_run_code_request,
    handle_stream_submission,
    handle_submit_code_request,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models.user import User
from app.schemas.submission import RunRequest, SubmitRequest

router = APIRouter(prefix="/api-v1/code", tags=["code"])


@router.post("/run", summary="Run code against sample or custom test cases (does not update marks)")
@router.post("/run-code", include_in_schema=False)
@limiter.limit("4/minute")
async def run_code_request(
    request: Request,
    submission: RunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Run code for testing and execution without updating marks or leaderboard.

    Test cases are provided by the client in the request body.
    Only the execution output/results are returned back to the user.
    """
    return await handle_run_code_request(submission, current_user=current_user, db=db)


@router.post(
    "/submit", summary="Submit code for evaluation against internal test cases (updates marks)"
)
@router.post("/submit-code")
@limiter.limit("4/minute")
async def submit_code_request(
    request: Request,
    submission: SubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Submit code for official problem evaluation against internal test cases.

    Test cases are loaded internally from the database and evaluated in the background.
    The response only returns evaluation results (tests passed, count, score) without exposing
    internal test-case inputs and expected outputs, and user marks are updated accordingly.
    """
    return await handle_submit_code_request(submission, current_user=current_user, db=db)


@router.get("/stream/{submission_id}")
async def stream_submission(
    submission_id: uuid.UUID,
) -> StreamingResponse:
    """Stream code submission results.
    This endpoint allows clients to stream the results of a code submission by its unique identifier. It retrieves the submission data from Redis and returns a streaming response to the client.
    Args:
        submission_id (uuid.UUID): Unique identifier for the submission.

    Returns:
        StreamingResponse: A streaming response containing the submission results.
    """
    return await handle_stream_submission(submission_id)


@router.get("/submission/poll/{submission_id}")
async def poll_submission(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Poll code submission status.
    This endpoint allows clients to poll the status of a code submission by its unique identifier. It retrieves the submission data from Redis and returns it to the client.

    Args:
        submission_id (str): Unique identifier for the submission.

    Returns:
        dict: A dictionary containing the submission data, including status, output, error messages, and other relevant information.
    Raises:
        HTTPException: If the submission is not found in Redis, a 404 error is raised
    """
    return await handle_poll_submission(str(submission_id), db=db)
