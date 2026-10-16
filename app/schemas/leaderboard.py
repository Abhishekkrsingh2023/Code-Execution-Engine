from pydantic import BaseModel, ConfigDict, Field


class LeaderboardEntryResponse(BaseModel):
    """Represents a single user entry on the competitive leaderboard."""

    rank: int = Field(..., description="Global placement rank.")
    user_id: str = Field(..., description="UUID primary key of the user.")
    username: str = Field(..., description="Unique user handle.")
    total_score: float = Field(..., description="Total points accumulated across problems.")
    problems_solved: int = Field(..., description="Total distinct problems solved.")
    submissions_count: int = Field(default=0, description="Total submissions attempted by user.")
    role: str = Field(default="user", description="Account authorization role.")
    created_at: str | None = Field(
        default=None, description="ISO timestamp of account registration."
    )

    model_config = ConfigDict(from_attributes=True)


class LeaderboardResponse(BaseModel):
    """Paginated leaderboard list response."""

    total: int = Field(..., description="Total number of active ranked users.")
    skip: int = Field(default=0, description="Pagination offset.")
    limit: int = Field(default=50, description="Page limit.")
    users: list[LeaderboardEntryResponse] = Field(..., description="List of ranked user profiles.")
    my_rank: LeaderboardEntryResponse | None = Field(
        default=None, description="Authenticated user's rank information if logged in."
    )
