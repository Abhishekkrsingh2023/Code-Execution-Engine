"""
Pydantic schemas for CommonProblemTemplate and ProblemTemplate.

Design principle: a schema encodes *who is allowed to set what*.
- *Create schemas: only fields the client should be trusted to provide.
- *Out schemas: everything the client is allowed to read back.
No schema is ever reused for both directions here on purpose.
"""
from datetime import datetime
from typing import List, Any
from pydantic import BaseModel, ConfigDict, Field


# ---------- CommonProblemTemplate ----------

class CommonProblemTemplateCreate(BaseModel):
    # client-supplied; server checks uniqueness, doesn't generate it.
    # max_length matches the DB column (String(4)) so an oversized ID
    # fails validation (422) instead of erroring at the SQL layer.
    problem_id: str = Field(max_length=4)
    problem_statement: str
    run_test_cases: List[Any] = []
    submit_test_cases: List[Any] = []
    time_limit: float = 2.0
    # NOTE: no created_at/updated_at — the DB sets those.


class CommonProblemTemplateUpdate(BaseModel):
    """All fields optional: PATCH-style partial update."""
    problem_statement: str | None = None
    run_test_cases: List[Any] | None = None
    submit_test_cases: List[Any] | None = None
    time_limit: float | None = None


class CommonProblemTemplateOut(BaseModel):
    problem_id: str
    problem_statement: str
    run_test_cases: List[Any]
    submit_test_cases: List[Any]
    time_limit: float
    created_at: datetime
    updated_at: datetime

    # Lets Pydantic read attributes off the SQLAlchemy ORM object directly
    # (obj.problem_id, obj.time_limit, ...) instead of requiring a dict.
    model_config = ConfigDict(from_attributes=True)


class CommonProblemTemplateDetailOut(CommonProblemTemplateOut):
    """Same as above, plus the nested per-language templates."""
    templates: List["ProblemTemplateOut"] = []


# ---------- ProblemTemplate (per-language) ----------

class ProblemTemplateCreate(BaseModel):
    user_code: str
    main_code: str
    # language and problem_id come from the URL path, not the body —
    # the URL is already the unique identity, so repeating it in the
    # body would just be a second source of truth that can disagree.


class ProblemTemplateUpdate(BaseModel):
    user_code: str | None = None
    main_code: str | None = None


class ProblemTemplateOut(BaseModel):
    problem_id: str
    language: str
    user_code: str
    main_code: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


CommonProblemTemplateDetailOut.model_rebuild()