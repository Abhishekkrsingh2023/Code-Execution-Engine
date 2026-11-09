from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.contest_controller import (
    handle_contest_run,
    handle_contest_submit,
    handle_create_contest,
    handle_delete_contest,
    handle_get_contest,
    handle_get_contest_leaderboard,
    handle_get_contest_my_rank,
    handle_get_contest_problem_detail,
    handle_get_contest_problems,
    handle_list_contests,
    handle_register_contest,
    handle_unregister_contest,
    handle_update_contest,
)
from app.database import get_db
from app.dependencies import (
    AdminUserDep,
    CurrentUserDep,
    CurrentUserOptionalDep,
    ModeratorUserDep,
)
from app.limiter import limiter
from app.schemas.contest import (
    ContestCreateRequest,
    ContestLeaderboardEntry,
    ContestLeaderboardResponse,
    ContestListResponse,
    ContestParticipantResponse,
    ContestProblemDetailResponse,
    ContestProblemResponse,
    ContestResponse,
    ContestRunRequest,
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
            description="Status filter: upcoming, live, or ended",
        ),
    ] = None,
    search: Annotated[str | None, Query(description="Search term in title or description")] = None,
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestListResponse:
    """Lists contests with status derived dynamically from the server clock."""
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
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestResponse:
    """Retrieves full contest details. Problem statements are hidden before start_time for non-staff."""
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
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    payload: ContestUpdateRequest,
    request: Request,
    current_user: ModeratorUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestResponse:
    """Updates a contest. If live, only title and description may be modified. If ended, locked."""
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
    summary="Delete an upcoming contest (Admin only)",
)
async def delete_contest(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    request: Request,
    current_user: AdminUserDep,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Deletes an upcoming contest. Rule 7 & 10: Admin only, allowed only for upcoming contests."""
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
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    request: Request,
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestParticipantResponse:
    """Registers an active, email-verified user for a contest up until its end time."""
    return await handle_register_contest(
        contest_id=contest_id,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.delete(
    "/{contest_id}/register",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Unregister from a contest",
)
async def unregister_contest(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Unregisters a participant before the contest start time."""
    return await handle_unregister_contest(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/{contest_id}/problems",
    response_model=list[ContestProblemResponse],
    status_code=status.HTTP_200_OK,
    summary="Get contest problem list",
)
async def get_contest_problems(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> list[ContestProblemResponse]:
    """Retrieves ordered problems in a contest. Returns 403 before start_time for non-staff."""
    return await handle_get_contest_problems(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/{contest_id}/problems/{problem_id}",
    response_model=ContestProblemDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get contest problem details and statement",
)
async def get_contest_problem_detail(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    problem_id: Annotated[int, Path(ge=1, description="Problem ID")],
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestProblemDetailResponse:
    """Retrieves problem statement. Returns 403 before start_time for non-staff."""
    return await handle_get_contest_problem_detail(
        contest_id=contest_id,
        problem_id=problem_id,
        current_user=current_user,
        db=db,
    )


@router.post(
    "/{contest_id}/submit",
    status_code=status.HTTP_201_CREATED,
    summary="Submit solution to a contest problem",
)
@limiter.limit("10/minute")
async def submit_contest_solution(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    payload: ContestSubmitRequest,
    request: Request,
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Submits code for evaluation during a live contest for a registered participant."""
    return await handle_contest_submit(
        contest_id=contest_id,
        payload=payload,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.post(
    "/{contest_id}/run",
    status_code=status.HTTP_200_OK,
    summary="Run code against test cases in a live contest",
)
@limiter.limit("20/minute")
async def run_contest_code(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    payload: ContestRunRequest,
    request: Request,
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Rule 11: Executes test cases in a live contest for a registered participant."""
    return await handle_contest_run(
        contest_id=contest_id,
        payload=payload,
        current_user=current_user,
        request=request,
        db=db,
    )


@router.get(
    "/{contest_id}/leaderboard",
    response_model=ContestLeaderboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get contest leaderboard",
)
async def get_contest_leaderboard(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    current_user: CurrentUserOptionalDep = None,
    db: AsyncSession = Depends(get_db),
) -> ContestLeaderboardResponse:
    """Retrieves real-time contest leaderboard computed under ICPC rules."""
    return await handle_get_contest_leaderboard(
        contest_id=contest_id,
        current_user=current_user,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get(
    "/{contest_id}/leaderboard/me",
    response_model=ContestLeaderboardEntry,
    status_code=status.HTTP_200_OK,
    summary="Get current user's contest rank",
)
async def get_contest_my_rank(
    contest_id: Annotated[int, Path(ge=1, description="Contest ID")],
    current_user: CurrentUserDep,
    db: AsyncSession = Depends(get_db),
) -> ContestLeaderboardEntry:
    """Retrieves the authenticated user's current rank and problem breakdown in this contest."""
    return await handle_get_contest_my_rank(
        contest_id=contest_id,
        current_user=current_user,
        db=db,
    )
