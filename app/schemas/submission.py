import uuid
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Language(str, Enum):
    c = "c"
    cpp = "cpp"
    java = "java"
    python = "python"


def get_uuid() -> str:
    return str(uuid.uuid4())  # full 128-bit UUID — do NOT slice, 8 chars risk collisions at scale


class TestCase(BaseModel):
    id: str | None = Field(default=None, description="Optional test case identifier.")
    input: str = Field(..., description="Input provided to the user's program.")
    expected_output: str = Field(..., description="Expected output for the given input.")
    weight: float = Field(
        default=1.0, ge=0.0, description="Weight/score assigned to this test case."
    )


class SubmissionRequest(BaseModel):
    """_summary_
    This class represents a request to submit code for execution.

    Attributes:
        problem_id (str): Unique identifier of the programming problem.
        submission_id (str): Unique identifier for the submission.
        problem_name (str): Name of the programming problem.
        user_code (str): Source code submitted by the user.
        language (Language): Programming language of the submission.
        test_cases (List[TestCase]): List of test cases against which the code will be executed
        time_limit (float): Maximum execution time in seconds, default is 2.0 seconds.
        user_id (str | None): Optional user identifier submitting the code.
    """

    problem_id: str = Field(..., description="Unique identifier of the programming problem.")
    submission_id: str = Field(
        default_factory=get_uuid, description="Unique identifier for the submission."
    )
    problem_name: str = Field(..., description="Name of the programming problem.")
    user_code: str = Field(..., min_length=1, description="Source code submitted by the user.")
    language: Language = Field(..., description="Programming language of the submission.")
    test_cases: list[TestCase] = Field(
        ..., min_length=1, description="List of test cases against which the code will be executed."
    )
    time_limit: float = Field(default=2.0, gt=0, description="Maximum execution time in seconds.")
    user_id: str | None = Field(
        default=None, description="Optional user ID associated with the submission."
    )

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
