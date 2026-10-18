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
    __test__ = False
    id: int | None = Field(default=None, description="Optional integer test case identifier.")
    input: str = Field(..., description="Input provided to the user's program.")
    expected_output: str = Field(..., description="Expected output for the given input.")
    weight: float = Field(
        default=1.0, ge=0.0, description="Weight/score assigned to this test case."
    )


class ExecutionMode(str, Enum):
    run = "run"
    submit = "submit"


class SubmissionRequest(BaseModel):
    """This class represents a request to run or submit code for execution.

    Attributes:
        problem_id (int): Unique integer identifier of the programming problem matching problems table.
        submission_id (str): Unique identifier for the submission.
        problem_name (str | None): Name of the programming problem.
        user_code (str): Source code submitted by the user.
        language (Language): Programming language of the submission.
        mode (ExecutionMode): Execution mode ('run' or 'submit').
        test_cases (List[TestCase]): List of test cases. For 'run', test cases are supplied by the frontend/client. For 'submit', test cases are loaded internally from DB.
        time_limit (float): Maximum execution time in seconds, default is 2.0 seconds.
        user_id (str | None): Optional user identifier submitting the code.
    """

    problem_id: int = Field(
        ...,
        ge=1,
        description="Unique integer identifier of the programming problem matching problems table.",
    )
    submission_id: str = Field(
        default_factory=get_uuid, description="Unique identifier for the submission."
    )
    problem_name: str | None = Field(
        default="Problem Submission", description="Name of the programming problem."
    )
    user_code: str = Field(..., min_length=1, description="Source code submitted by the user.")
    language: Language = Field(..., description="Programming language of the submission.")
    mode: ExecutionMode = Field(
        default=ExecutionMode.submit,
        description="Execution mode: 'run' (test run without updating marks) or 'submit' (evaluates against internal test cases, updates marks).",
    )
    test_cases: list[TestCase] = Field(
        default_factory=list,
        description="List of test cases against which the code will be executed. For submit mode, test cases are loaded internally from the database.",
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


class RunRequest(SubmissionRequest):
    mode: ExecutionMode = Field(
        default=ExecutionMode.run,
        description="Execution mode for run (defaults to 'run').",
    )


class SubmitRequest(SubmissionRequest):
    mode: ExecutionMode = Field(
        default=ExecutionMode.submit,
        description="Execution mode for submit (defaults to 'submit').",
    )
