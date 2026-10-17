import uuid
from datetime import datetime

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
        examples=[
            "Given an array of integers, return indices of two numbers such that they add up to target."
        ],
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

    title: str | None = Field(None, min_length=3, max_length=255)
    description: str | None = Field(None, min_length=5)
    difficulty: ProblemDifficulty | None = None
    category: str | None = Field(None, max_length=100)
    topic: str | None = Field(None, max_length=100)
    time_limit: float | None = Field(None, ge=0.1, le=30.0)
    memory_limit: int | None = Field(None, ge=16, le=2048)
    status: ProblemStatus | None = None

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
    problem_code: int | None = Field(
        default=None, description="Integer problem identifier matching id."
    )
    title: str = Field(..., description="Problem title.")
    description: str = Field(..., description="Problem description.")
    difficulty: ProblemDifficulty = Field(..., description="Problem difficulty.")
    category: str = Field(..., description="Problem category.")
    topic: str = Field(
        ..., description="Problem topic tag (e.g. array, tree, linkedlist, recursion)."
    )
    status: ProblemStatus = Field(..., description="Problem publication status.")
    time_limit: float = Field(..., description="Time limit in seconds.")
    memory_limit: int = Field(..., description="Memory limit in megabytes.")
    created_by: uuid.UUID | None = Field(None, description="Creator user ID (moderator or admin).")
    created_at: datetime = Field(..., description="Creation timestamp in UTC.")
    updated_at: datetime = Field(..., description="Last update timestamp in UTC.")
    is_deleted: bool = Field(default=False, description="Soft-deletion status.")
    deleted_at: datetime | None = Field(None, description="Deletion timestamp in UTC.")

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


class TestCaseCreateItem(BaseModel):
    """Schema for individual test case item."""

    input: str = Field(..., description="Standard input string.")
    expected_output: str = Field(..., description="Expected output string.")
    is_sample: bool = Field(
        default=False, description="Flag indicating if this is a sample/run test case."
    )
    weight: float = Field(default=1.0, description="Score weight for this test case.")

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TestCaseResponse(BaseModel):
    """Public representation of a test case."""

    id: int = Field(..., description="Unique test case identifier.")
    problem_id: int = Field(..., description="Associated problem ID.")
    input: str = Field(..., description="Standard input.")
    expected_output: str = Field(..., description="Expected output.")
    is_sample: bool = Field(..., description="Whether this is a sample test case.")
    weight: float = Field(..., description="Score weight.")

    model_config = ConfigDict(from_attributes=True)


class ProblemTemplateItem(BaseModel):
    """Schema for a language problem template item."""

    language: str = Field(
        ..., max_length=20, description="Programming language (e.g. python, cpp)."
    )
    boilerplate_code: str | None = Field(
        default=None, description="Starter boilerplate code for user, if any."
    )

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ProblemTemplateResponse(BaseModel):
    """Public representation of a problem template."""

    problem_id: int = Field(..., description="Integer problem ID.")
    language: str = Field(..., description="Programming language.")
    boilerplate_code: str | None = Field(default=None, description="Starter boilerplate code.")
    created_at: datetime = Field(..., description="Creation timestamp in UTC.")
    updated_at: datetime = Field(..., description="Last update timestamp in UTC.")

    model_config = ConfigDict(from_attributes=True)


class CommonProblemTemplateCreateRequest(BaseModel):
    """Schema for creating or updating a common problem template."""

    problem_id: int = Field(
        ..., ge=1, description="Integer problem identifier matching problems table."
    )
    problem_statement: str = Field(
        ..., min_length=5, description="Problem statement text or markdown."
    )
    time_limit: float = Field(default=2.0, ge=0.1, le=30.0, description="Time limit in seconds.")
    run_test_cases: list[dict] = Field(
        default_factory=list,
        description="List of run/sample test cases [{input, expected_output}].",
    )
    submit_test_cases: list[dict] = Field(
        default_factory=list,
        description="List of hidden/submit test cases [{input, expected_output}].",
    )

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CommonProblemTemplateResponse(BaseModel):
    """Public representation of a common problem template."""

    problem_id: int = Field(..., description="Integer problem identifier.")
    problem_statement: str = Field(..., description="Problem statement text.")
    time_limit: float = Field(..., description="Execution time limit in seconds.")
    run_test_cases: list[dict] = Field(..., description="Run test cases.")
    submit_test_cases: list[dict] = Field(..., description="Submit test cases.")
    created_at: datetime = Field(..., description="Creation timestamp in UTC.")
    updated_at: datetime = Field(..., description="Last update timestamp in UTC.")
    templates: list[ProblemTemplateResponse] = Field(
        default_factory=list, description="Associated language problem templates."
    )

    model_config = ConfigDict(from_attributes=True)


class FullProblemCreateRequest(BaseModel):
    """Unified schema for creating problem, common problem template, language templates, and test cases."""

    # Problem fields
    title: str = Field(..., min_length=3, max_length=255, description="Problem title.")
    description: str = Field(..., min_length=5, description="Detailed problem statement.")
    difficulty: ProblemDifficulty = Field(
        default=ProblemDifficulty.EASY, description="Difficulty level."
    )
    category: str = Field(default="General", max_length=100, description="Category.")
    topic: str = Field(default="General", max_length=100, description="Topic tag.")
    time_limit: float = Field(default=2.0, ge=0.1, le=30.0, description="Time limit in seconds.")
    memory_limit: int = Field(default=256, ge=16, le=2048, description="Memory limit in MB.")
    status: ProblemStatus = Field(
        default=ProblemStatus.PUBLISHED, description="Publication status."
    )

    # Integer ID for templates (optional, auto-assigned from created Problem.id if omitted)
    problem_code: int | None = Field(
        None, ge=1, description="Custom integer problem ID for templates."
    )
    problem_id: int | None = Field(
        None, ge=1, description="Custom integer problem ID for templates (alias)."
    )

    # Test cases: Common run & submit
    run_test_cases: list[dict] = Field(
        default_factory=list, description="Run/sample test cases [{input, expected_output}]."
    )
    submit_test_cases: list[dict] = Field(
        default_factory=list, description="Submit/hidden test cases [{input, expected_output}]."
    )

    # Multi-language templates
    templates: list[ProblemTemplateItem] = Field(
        default_factory=list, description="Language-specific starter and driver templates."
    )

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class FullProblemResponse(BaseModel):
    """Detailed response containing problem, test cases, and templates."""

    problem: ProblemResponse = Field(..., description="Problem core details.")
    problem_code: int = Field(..., description="Integer problem ID in template system.")
    problem_id: int | None = Field(None, description="Integer problem ID in template system.")
    run_test_cases: list[dict] = Field(default_factory=list, description="Run test cases.")
    submit_test_cases: list[dict] = Field(default_factory=list, description="Submit test cases.")
    templates: list[ProblemTemplateResponse] = Field(
        default_factory=list, description="Language problem templates."
    )
    test_cases_count: int = Field(default=0, description="Total test cases in database.")

    model_config = ConfigDict(from_attributes=True)

