import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.contest_controller import (
    handle_assign_problem,
    handle_contest_run,
    handle_contest_submit,
    handle_create_contest,
    handle_delete_contest,
    handle_get_contest,
    handle_get_contest_leaderboard,
    handle_get_contest_my_rank,
    handle_get_contest_participants,
    handle_get_contest_problem_detail,
    handle_get_contest_problems,
    handle_get_contest_submissions,
    handle_get_my_contest_submissions,
    handle_list_contests,
    handle_register_contest,
    handle_remove_problem,
    handle_unregister_contest,
    handle_update_contest,
    handle_update_problem_in_contest,
)
from app.database import get_db
from app.dependencies import (
    CurrentUserDep,
    CurrentUserOptionalDep,
    ModeratorUserDep,
)
from app.limiter import limiter
from app.schemas.contest import (
    ContestCreateRequest,
    ContestLeaderboardResponse,
    ContestListResponse,
    ContestParticipantResponse,
    ContestProblemAssignRequest,
    ContestProblemDetailResponse,
    ContestProblemResponse,
    ContestProblemUpdateRequest,
    ContestResponse,
    ContestRunRequest,
    ContestSubmissionListResponse,
    ContestSubmitRequest,
    ContestUpdateRequest,
)
from app.schemas.user import MessageResponse

router = APIRouter(
    prefix="/api-v1/contests",
    tags=["contests"],
)


@router.post(
    "",
    response_model=ContestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new contest (Admin or Moderator)",
)
async def create_contest(
    payload: ContestCreateRequest,
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestResponse:
    """Creates a new contest with scheduling, duration, and scoring parameters."""
    return await handle_create_contest(
        payload=payload,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.get(
    "",
    response_model=ContestListResponse,
    status_code=status.HTTP_200_OK,
    summary="List contests with lifecycle filtering and search",
)
async def list_contests(
    skip: Annotated[int, Query(ge=0, description="Offset")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit")] = 20,
    contest_status: Annotated[
        str | None,
        Query(
            alias="status",
            description="Status filter: upcoming, active, completed, draft, or cancelled",
        ),
    ] = None,
    search: Annotated[str | None, Query(description="Search term in title or description")] = None,
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestListResponse:
    """Lists contests. Regular users only see published contests (upcoming, active, completed)."""
    return await handle_list_contests(
        skip=skip,
        limit=limit,
        contest_status=contest_status,
        search=search,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/{contest_id}",
    response_model=ContestResponse,
    status_code=status.HTTP_200_OK,
    summary="Get contest details",
)
async def get_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestResponse:
    """Retrieves full contest details, registration status, and assigned problems when active/completed."""
    return await handle_get_contest(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.patch(
    "/{contest_id}",
    response_model=ContestResponse,
    status_code=status.HTTP_200_OK,
    summary="Update contest parameters (Admin or Moderator)",
)
async def update_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    payload: ContestUpdateRequest,
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestResponse:
    """Updates contest timing, title, description, or status."""
    return await handle_update_contest(
        contest_id=contest_id,
        payload=payload,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.delete(
    "/{contest_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete contest (Admin or Moderator)",
)
async def delete_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Deletes a contest and cascade deletes participant and problem associations."""
    return await handle_delete_contest(
        contest_id=contest_id,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.post(
    "/{contest_id}/register",
    response_model=ContestParticipantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register for a contest",
)
async def register_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestParticipantResponse:
    """Registers the authenticated user for an upcoming or active contest."""
    return await handle_register_contest(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.delete(
    "/{contest_id}/register",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Unregister from a contest (before start only)",
)
async def unregister_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Unregisters the user from an upcoming contest."""
    return await handle_unregister_contest(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.post(
    "/{contest_id}/problems",
    response_model=ContestProblemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a problem to contest (Admin or Moderator)",
)
async def assign_problem_to_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    payload: ContestProblemAssignRequest,
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestProblemResponse:
    """Assigns an existing problem to the contest with configured points and ordering."""
    return await handle_assign_problem(
        contest_id=contest_id,
        payload=payload,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.delete(
    "/{contest_id}/problems/{problem_id:int}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove a problem from contest (Admin or Moderator)",
)
async def remove_problem_from_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    problem_id: Annotated[int, Path(ge=1, description="Problem ID")],
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Removes a problem assignment from the contest."""
    return await handle_remove_problem(
        contest_id=contest_id,
        problem_id=problem_id,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.patch(
    "/{contest_id}/problems/{problem_id:int}",
    response_model=ContestProblemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update problem points or ordering in contest (Admin or Moderator)",
)
async def update_problem_in_contest(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    problem_id: Annotated[int, Path(ge=1, description="Problem ID")],
    payload: ContestProblemUpdateRequest,
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestProblemResponse:
    """Updates points or order index for an assigned problem."""
    return await handle_update_problem_in_contest(
        contest_id=contest_id,
        problem_id=problem_id,
        payload=payload,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.get(
    "/{contest_id}/problems",
    response_model=list[ContestProblemResponse],
    status_code=status.HTTP_200_OK,
    summary="List problems assigned to contest",
)
async def list_contest_problems(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> list[ContestProblemResponse]:
    """Lists problems assigned to the contest once the contest is active or completed."""
    return await handle_get_contest_problems(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/{contest_id}/problems/{problem_id:int}",
    response_model=ContestProblemDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get contest problem details and sample test cases",
)
async def get_contest_problem_detail(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    problem_id: Annotated[int, Path(ge=1, description="Problem ID")],
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestProblemDetailResponse:
    """Retrieves problem statement, sample test cases, and constraints for contest solving."""
    return await handle_get_contest_problem_detail(
        contest_id=contest_id,
        problem_id=problem_id,
        current_user=current_user,
        db=db,
    )


@router.post(
    "/{contest_id}/submit",
    status_code=status.HTTP_200_OK,
    summary="Submit solution to contest problem",
)
@limiter.limit("6/minute")
async def submit_contest_solution(
    request: Request,
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    payload: ContestSubmitRequest,
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Submits code for evaluation within this contest, strictly enforcing time windows and registration."""
    return await handle_contest_submit(
        contest_id=contest_id,
        payload=payload,
        current_user=current_user,
        db=db,
    )


@router.post(
    "/{contest_id}/run",
    status_code=status.HTTP_200_OK,
    summary="Run code against sample or custom test cases within contest problem",
)
@limiter.limit("6/minute")
async def run_contest_test_cases(
    request: Request,
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    payload: ContestRunRequest,
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Runs code for testing within contest problem without altering contest score."""
    return await handle_contest_run(
        contest_id=contest_id,
        payload=payload,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/{contest_id}/leaderboard",
    response_model=ContestLeaderboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get contest leaderboard and winner information",
)
async def get_contest_leaderboard(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestLeaderboardResponse:
    """Retrieves ranked contest leaderboard with tie-breaking rules and winner information."""
    return await handle_get_contest_leaderboard(
        contest_id=contest_id,
        current_user=current_user,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get(
    "/{contest_id}/leaderboard/me",
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user's rank in contest",
)
async def get_my_contest_rank(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Returns current user's contest ranking and score breakdown."""
    return await handle_get_contest_my_rank(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/{contest_id}/participants",
    response_model=list[ContestParticipantResponse],
    status_code=status.HTTP_200_OK,
    summary="List registered participants in contest",
)
async def list_contest_participants(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
) -> list[ContestParticipantResponse]:
    """Lists registered participants in the contest."""
    return await handle_get_contest_participants(
        contest_id=contest_id,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get(
    "/{contest_id}/submissions",
    response_model=ContestSubmissionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all submissions in contest (Admin or Moderator)",
)
async def list_contest_submissions(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: ModeratorUserDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    user_id: Annotated[uuid.UUID | None, Query(description="Filter by user")] = None,
    problem_id: Annotated[int | None, Query(description="Filter by problem")] = None,
    db: AsyncSession = Depends(get_db),
) -> ContestSubmissionListResponse:
    """Lists all submissions made during the contest for moderators and administrators."""
    return await handle_get_contest_submissions(
        contest_id=contest_id,
        skip=skip,
        limit=limit,
        user_id=user_id,
        problem_id=problem_id,
        db=db,
    )


@router.get(
    "/{contest_id}/my-submissions",
    response_model=ContestSubmissionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List my submissions in contest",
)
async def list_my_contest_submissions(
    contest_id: Annotated[uuid.UUID, Path(description="Contest UUID")],
    current_user: CurrentUserDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    problem_id: Annotated[int | None, Query(description="Filter by problem")] = None,
    db: AsyncSession = Depends(get_db),
) -> ContestSubmissionListResponse:
    """Lists authenticated user's submissions in this contest."""
    return await handle_get_my_contest_submissions(
        contest_id=contest_id,
        current_user=current_user,
        skip=skip,
        limit=limit,
        problem_id=problem_id,
        db=db,
    )
