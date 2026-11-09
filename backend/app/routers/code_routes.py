import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.code_controller import (
    handle_poll_submission,
    handle_run_code_request,
    handle_stream_submission,
    handle_submit_code_request,
)
from app.controllers.user_controller import (
    handle_get_user_submission_detail,
    handle_get_user_submissions,
)
from app.database import get_db
from app.dependencies import CurrentUserDep, get_current_user
from app.limiter import limiter
from app.models.user import User
from app.schemas.submission import (
    RunRequest,
    SubmitRequest,
    UserSubmissionListResponse,
    UserSubmissionResponse,
)

router = APIRouter(prefix="/api-v1/code", tags=["code"])


@router.post("/run", summary="Run code against sample or custom test cases (does not update marks)")
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


@router.get(
    "/submissions/me",
    response_model=UserSubmissionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List authenticated user's code submissions",
)
async def list_my_code_submissions(
    current_user: CurrentUserDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    problem_id: Annotated[int | None, Query(description="Filter by problem")] = None,
    status: Annotated[str | None, Query(description="Filter by status")] = None,
    db: AsyncSession = Depends(get_db),
) -> UserSubmissionListResponse:
    """Lists code submissions made by authenticated user."""
    return await handle_get_user_submissions(
        current_user=current_user,
        skip=skip,
        limit=limit,
        problem_id=problem_id,
        status_filter=status,
        db=db,
    )


@router.get(
    "/submissions/{submission_id}",
    response_model=UserSubmissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user submission details",
)
async def get_my_code_submission(
    submission_id: Annotated[uuid.UUID, Path(description="Submission UUID")],
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> UserSubmissionResponse:
    """Retrieves single submission details owned by authenticated user."""
    return await handle_get_user_submission_detail(
        submission_id=submission_id,
        current_user=current_user,
        db=db,
    )


@router.get("/languages", summary="Get platform supported programming languages")
async def get_supported_languages() -> list[str]:
    """Returns platform supported execution languages (source of truth)."""
    from app.models.submission import SubmissionLanguage

    return [lang.value for lang in SubmissionLanguage]
