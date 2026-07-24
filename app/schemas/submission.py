from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
import uuid

class Language(str, Enum):
    c = "c"
    cpp = "cpp"
    java = "java"
    python = "python"

def get_uuid():
    return str(uuid.uuid4())[0:8]  # Return the first 8 characters of the UUID


class TestCase(BaseModel):
    input: str = Field(...,description="Input provided to the user's program.")
    expected_output: str = Field(...,description="Expected output for the given input.")


class SubmissionRequest(BaseModel):
    problem_id: str = Field(..., description="Unique identifier of the programming problem.")
    submission_id: str = Field(default_factory=get_uuid, description="Unique identifier for the submission.")
    problem_name: str = Field(..., description="Name of the programming problem.")
    user_code: str = Field(..., min_length=1, description="Source code submitted by the user.")
    language: Language = Field(..., description="Programming language of the submission.")
    test_cases: list[TestCase] = Field(..., min_length=1, description="List of test cases against which the code will be executed.")
    time_limit: float = Field(default=2.0, gt=0, description="Maximum execution time in seconds.")

    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

class Submission(BaseModel):
    submission_id: str = Field(default_factory=get_uuid)
    user_code: str
    main_code: str
    language: Language
    test_cases: list[TestCase] = Field(..., min_length=1, description="List of test cases against which the code will be executed.")
    time_limit: float = Field(default=2.0, gt=0, description="Maximum execution time in seconds.")
    
    model_config = ConfigDict(
        use_enum_values=True,
        extra="forbid",
        str_strip_whitespace=True,
    )