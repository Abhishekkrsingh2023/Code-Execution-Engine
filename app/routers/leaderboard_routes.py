from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.leaderboard import LeaderboardEntryResponse, LeaderboardResponse
from app.services.leaderboard_service import get_leaderboard_data, get_user_rank_data

router = APIRouter(
    prefix="/api-v1/leaderboard",
    tags=["leaderboard"],
)


@router.get(
    "",
    response_model=LeaderboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get global competitive leaderboard",
    description="Retrieves a paginated ranking of users ordered by total score, problems solved, and registration date.",
)
async def get_leaderboard(
    skip: int = Query(default=0, ge=0, description="Pagination offset."),
    limit: int = Query(default=50, ge=1, le=100, description="Page limit."),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    total, users_data = await get_leaderboard_data(
        db=db,
        skip=skip,
        limit=limit,
    )

    my_rank_data = None
    if current_user:
        raw_my_rank = await get_user_rank_data(current_user.id, db)
        if raw_my_rank:
            my_rank_data = LeaderboardEntryResponse(**raw_my_rank)

    return LeaderboardResponse(
        total=total,
        skip=skip,
        limit=limit,
        users=[LeaderboardEntryResponse(**u) for u in users_data],
        my_rank=my_rank_data,
    )


@router.get(
    "/me",
    response_model=LeaderboardEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user rank",
    description="Fetches current authenticated user's global leaderboard rank and statistics.",
)
async def get_my_leaderboard_rank(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardEntryResponse:
    rank_data = await get_user_rank_data(current_user.id, db)
    if not rank_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leaderboard profile not found.",
        )
    return LeaderboardEntryResponse(**rank_data)
