import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.schemas.submission import TestCase


class ContestCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255, description="Title of the contest.")
    description: str | None = Field(
        default=None, description="Detailed description or rules of the contest."
    )
    start_time: datetime = Field(description="Contest start time (ISO 8601 with timezone).")
    end_time: datetime = Field(description="Contest end time (ISO 8601 with timezone).")
    penalty_minutes: int = Field(
        default=20,
        ge=0,
        description="Penalty time in minutes assessed for each wrong attempt before solving.",
    )
    problem_ids: list[int] = Field(
        min_length=1,
        description="Ordered list of problem IDs in the contest (P1, P2, P3...).",
    )

    @model_validator(mode="after")
    def validate_contest(self) -> "ContestCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("Contest end_time must be strictly after start_time.")
        if len(self.problem_ids) == 0:
            raise ValueError("Contest must have at least one problem.")
        if len(self.problem_ids) != len(set(self.problem_ids)):
            raise ValueError("Contest cannot contain duplicate problems.")
        return self

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class ContestUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None)
    start_time: datetime | None = Field(default=None)
    end_time: datetime | None = Field(default=None)
    penalty_minutes: int | None = Field(default=None, ge=0)
    problem_ids: list[int] | None = Field(default=None)

    @model_validator(mode="after")
    def validate_contest_update(self) -> "ContestUpdateRequest":
        if self.start_time is not None and self.end_time is not None:
            if self.end_time <= self.start_time:
                raise ValueError("Contest end_time must be strictly after start_time.")
        if self.problem_ids is not None:
            if len(self.problem_ids) == 0:
                raise ValueError("Contest must have at least one problem.")
            if len(self.problem_ids) != len(set(self.problem_ids)):
                raise ValueError("Contest cannot contain duplicate problems.")
        return self

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class ContestProblemAssignRequest(BaseModel):
    problem_id: int = Field(ge=1, description="Integer ID of the problem to assign.")
    points: float = Field(default=100.0, gt=0, description="Points awarded for this problem.")
    position: int | None = Field(default=None, ge=1, description="Position (1-indexed) in contest.")

    model_config = ConfigDict(extra="forbid")


class ContestProblemUpdateRequest(BaseModel):
    points: float | None = Field(default=None, gt=0)
    position: int | None = Field(default=None, ge=1)

    model_config = ConfigDict(extra="forbid")


class ContestProblemResponse(BaseModel):
    id: int
    problem_id: int
    title: str
    difficulty: str
    points: float
    position: int

    model_config = ConfigDict(from_attributes=True)


class ContestProblemDetailResponse(ContestProblemResponse):
    description: str
    time_limit: float
    memory_limit: int
    sample_test_cases: list[dict[str, Any]] = Field(default_factory=list)


class ContestParticipantResponse(BaseModel):
    id: int
    contest_id: int
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
    id: int
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    status: str
    penalty_minutes: int
    participant_count: int = 0
    problem_count: int = 0
    is_registered: bool = False
    created_by: uuid.UUID | None = None
    created_at: datetime
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    problems: list[ContestProblemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ContestListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
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
    last_accepted_at: datetime | None = None
    problem_scores: dict[str, Any] = Field(default_factory=dict)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def problems(self) -> list[ContestProblemScore]:
        result: list[ContestProblemScore] = []
        for k, v in self.problem_scores.items():
            if isinstance(v, dict):
                try:
                    prob_id = int(v.get("problem_id", k))
                except (ValueError, TypeError):
                    prob_id = 0
                result.append(
                    ContestProblemScore(
                        problem_id=prob_id,
                        score=float(v.get("score", 0.0)),
                        is_solved=bool(v.get("is_solved", False)),
                        attempts=int(v.get("attempts", 0)),
                        solved_time_seconds=v.get("solved_time_seconds"),
                        penalty_seconds=int(v.get("penalty_seconds", 0)),
                    )
                )
        return result


class ContestLeaderboardResponse(BaseModel):
    contest_id: int
    contest_title: str
    status: str
    total_participants: int
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    winner: ContestLeaderboardEntry | None = None
    leaderboard: list[ContestLeaderboardEntry] = Field(default_factory=list)
    my_rank: ContestLeaderboardEntry | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def entries(self) -> list[ContestLeaderboardEntry]:
        return self.leaderboard


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
    test_cases: list[TestCase] = Field(
        default_factory=list, description="Test cases to run against."
    )
    time_limit: float = Field(default=2.0, gt=0)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ContestSubmissionResponse(BaseModel):
    id: uuid.UUID
    contest_id: int | None = None
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
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    submissions: list[ContestSubmissionResponse]
