import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.problem import ProblemDifficulty, ProblemStatus


class ProblemCreateRequest(BaseModel):
    """Schema for creating a programming problem."""
    title: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Title of the problem.",
        examples=["Two Sum"],
    )
    description: str = Field(
        ...,
        min_length=5,
        description="Detailed problem statement and description.",
        examples=["Given an array of integers, return indices of two numbers such that they add up to target."],
    )
    difficulty: ProblemDifficulty = Field(
        default=ProblemDifficulty.EASY,
        description="Difficulty level (easy, medium, hard).",
        examples=[ProblemDifficulty.EASY],
    )
    category: str = Field(
        default="General",
        max_length=100,
        description="Category classification for the problem.",
        examples=["Algorithms"],
    )
    topic: str = Field(
        default="General",
        max_length=100,
        description="Problem topic/data-structure tag (e.g. array, tree, linkedlist, recursion).",
        examples=["array"],
    )
    time_limit: float = Field(
        default=2.0,
        ge=0.1,
        le=30.0,
        description="Maximum execution time limit in seconds.",
        examples=[2.0],
    )
    memory_limit: int = Field(
        default=256,
        ge=16,
        le=2048,
        description="Maximum execution memory limit in megabytes (MB).",
        examples=[256],
    )
    status: ProblemStatus = Field(
        default=ProblemStatus.PUBLISHED,
        description="Publication status (published, unpublished, draft, archived).",
        examples=[ProblemStatus.PUBLISHED],
    )

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class ProblemUpdateRequest(BaseModel):
    """Schema for updating problem fields."""
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=5)
    difficulty: Optional[ProblemDifficulty] = None
    category: Optional[str] = Field(None, max_length=100)
    topic: Optional[str] = Field(None, max_length=100)
    time_limit: Optional[float] = Field(None, ge=0.1, le=30.0)
    memory_limit: Optional[int] = Field(None, ge=16, le=2048)
    status: Optional[ProblemStatus] = None

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class ProblemStatusUpdateRequest(BaseModel):
    """Schema for updating problem publication status."""
    status: ProblemStatus = Field(
        ...,
        description="New publication status (published, unpublished, draft, archived).",
    )

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class ProblemResponse(BaseModel):
    """Public representation of a problem."""
    id: int = Field(..., description="Unique problem identifier.")
    title: str = Field(..., description="Problem title.")
    description: str = Field(..., description="Problem description.")
    difficulty: ProblemDifficulty = Field(..., description="Problem difficulty.")
    category: str = Field(..., description="Problem category.")
    topic: str = Field(..., description="Problem topic tag (e.g. array, tree, linkedlist, recursion).")
    status: ProblemStatus = Field(..., description="Problem publication status.")
    time_limit: float = Field(..., description="Time limit in seconds.")
    memory_limit: int = Field(..., description="Memory limit in megabytes.")
    created_by: Optional[uuid.UUID] = Field(None, description="Creator user ID (moderator or admin).")
    created_at: datetime = Field(..., description="Creation timestamp in UTC.")
    updated_at: datetime = Field(..., description="Last update timestamp in UTC.")
    is_deleted: bool = Field(default=False, description="Soft-deletion status.")
    deleted_at: Optional[datetime] = Field(None, description="Deletion timestamp in UTC.")

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )


class ProblemListResponse(BaseModel):
    """Paginated problem listing response."""
    total: int = Field(..., description="Total problem count.")
    skip: int = Field(..., description="Offset.")
    limit: int = Field(..., description="Page limit.")
    problems: list[ProblemResponse] = Field(..., description="List of problems.")
