import uuid
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.submission import SubmissionRequest
from app.controllers.code_controller import (
    handle_poll_submission,
    handle_submit_code_request,
    handle_stream_submission
)

router = APIRouter(
    prefix="/api-v1/code",
    tags=["code"]
)


@router.post("/submit-code")
async def submit_code_request(submission: SubmissionRequest):
    """_summary_
    This endpoint allows clients to submit code for execution. It handles the submission and returns a response with the submission status and streaming URL.
    Args:
        submission (SubmissionRequest): A request object containing the submission details.

    Returns:
        dict: A dictionary containing the submission status and streaming URL.
    """
    return await handle_submit_code_request(submission)


@router.get("/stream/{submission_id}")
async def stream_submission(submission_id: uuid.UUID)-> StreamingResponse:
    """_summary_
    This endpoint allows clients to stream the results of a code submission by its unique identifier. It retrieves the submission data from Redis and returns a streaming response to the client.
    Args:
        submission_id (uuid.UUID): Unique identifier for the submission.

    Returns:
        StreamingResponse: A streaming response containing the submission results.
    """
    return await handle_stream_submission(submission_id)


@router.get("/submission/poll/{submission_id}")
async def poll_submission(submission_id: str):
    """_summary_
    This endpoint allows clients to poll the status of a code submission by its unique identifier. It retrieves the submission data from Redis and returns it to the client.

    Args:
        submission_id (str): Unique identifier for the submission.

    Returns:
        dict: A dictionary containing the submission data, including status, output, error messages, and other relevant information.
    Raises:
        HTTPException: If the submission is not found in Redis, a 404 error is raised
    """
    return await handle_poll_submission(submission_id)
