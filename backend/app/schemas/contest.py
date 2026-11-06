import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.contest import ContestStatus
from app.schemas.submission import TestCase


class ContestCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255, description="Title of the contest.")
    description: str | None = Field(default=None, description="Detailed description or rules of the contest.")
    start_time: datetime = Field(description="Contest start time (ISO 8601 with timezone).")
    end_time: datetime = Field(description="Contest end time (ISO 8601 with timezone).")
    status: ContestStatus = Field(
        default=ContestStatus.UPCOMING,
        description="Initial status: draft or upcoming.",
    )
    penalty_minutes: int = Field(
        default=20,
        ge=0,
        description="Penalty time in minutes assessed for each wrong attempt before solving.",
    )

    @model_validator(mode="after")
    def validate_duration(self) -> "ContestCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("Contest end_time must be strictly after start_time.")
        return self

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class ContestUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None)
    start_time: datetime | None = Field(default=None)
    end_time: datetime | None = Field(default=None)
    status: ContestStatus | None = Field(default=None)
    penalty_minutes: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_duration(self) -> "ContestUpdateRequest":
        if self.start_time is not None and self.end_time is not None:
            if self.end_time <= self.start_time:
                raise ValueError("Contest end_time must be strictly after start_time.")
        return self

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class ContestProblemAssignRequest(BaseModel):
    problem_id: int = Field(ge=1, description="Integer ID of the problem to assign.")
    points: float = Field(default=100.0, gt=0, description="Points awarded for this problem.")
    order_index: int | None = Field(default=None, ge=0, description="Ordering index in contest.")

    model_config = ConfigDict(extra="forbid")


class ContestProblemUpdateRequest(BaseModel):
    points: float | None = Field(default=None, gt=0)
    order_index: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid")


class ContestProblemResponse(BaseModel):
    id: int
    problem_id: int
    title: str
    difficulty: str
    points: float
    order_index: int

    model_config = ConfigDict(from_attributes=True)


class ContestProblemDetailResponse(ContestProblemResponse):
    description: str
    time_limit: float
    memory_limit: int
    sample_test_cases: list[dict[str, Any]] = Field(default_factory=list)


class ContestParticipantResponse(BaseModel):
    id: int
    user_id: uuid.UUID
    username: str
    name: str | None = None
    registered_at: datetime
    score: float = 0.0
    problems_solved: int = 0
    penalty_seconds: int = 0
    rank: int | None = None

    model_config = ConfigDict(from_attributes=True)


class ContestResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    status: str
    stored_status: str
    penalty_minutes: int
    participant_count: int = 0
    problem_count: int = 0
    is_registered: bool = False
    created_by: uuid.UUID | None = None
    created_at: datetime
    problems: list[ContestProblemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ContestListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    contests: list[ContestResponse]


class ContestProblemScore(BaseModel):
    problem_id: int
    score: float
    is_solved: bool
    attempts: int
    solved_time_seconds: int | None = None
    penalty_seconds: int = 0


class ContestLeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    score: float
    problems_solved: int
    penalty_seconds: int
    problem_scores: dict[str, Any] = Field(default_factory=dict)


class ContestLeaderboardResponse(BaseModel):
    contest_id: uuid.UUID
    contest_title: str
    status: str
    total_participants: int
    winner: ContestLeaderboardEntry | None = None
    leaderboard: list[ContestLeaderboardEntry] = Field(default_factory=list)
    my_rank: ContestLeaderboardEntry | None = None


class ContestSubmitRequest(BaseModel):
    problem_id: int = Field(ge=1, description="Problem ID belonging to this contest.")
    user_code: str = Field(min_length=1, description="Source code submitted.")
    language: str = Field(description="Submission language (python, cpp, c, java).")
    time_limit: float = Field(default=2.0, gt=0)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ContestRunRequest(BaseModel):
    problem_id: int = Field(ge=1, description="Problem ID belonging to this contest.")
    user_code: str = Field(min_length=1, description="Source code to run.")
    language: str = Field(description="Programming language.")
    test_cases: list[TestCase] = Field(default_factory=list, description="Test cases to run against.")
    time_limit: float = Field(default=2.0, gt=0)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ContestSubmissionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    username: str | None = None
    problem_id: int | None = None
    problem_name: str | None = None
    language: str
    status: str
    score: float
    max_score: float
    tests_passed: int
    total_tests: int
    execution_time: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContestSubmissionListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    submissions: list[ContestSubmissionResponse]

