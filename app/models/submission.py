import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import _utcnow

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.submission_result import SubmissionResult
    from app.models.user import User


class SubmissionLanguage(str, enum.Enum):
    PYTHON = "python"
    CPP = "cpp"
    C = "c"
    JAVA = "java"
    JAVASCRIPT = "javascript"


class SubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    MEMORY_LIMIT_EXCEEDED = "memory_limit_exceeded"
    COMPILATION_ERROR = "compilation_error"
    RUNTIME_ERROR = "runtime_error"
    INTERNAL_ERROR = "internal_error"


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    problem_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("problems.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    problem_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    language: Mapped[SubmissionLanguage] = mapped_column(
        SAEnum(
            SubmissionLanguage, native_enum=False, values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
    )
    source_code: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[SubmissionStatus] = mapped_column(
        SAEnum(SubmissionStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=SubmissionStatus.PENDING,
        index=True,
        nullable=False,
    )
    score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        comment="Total score earned on this submission based on passed tests",
    )
    max_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        comment="Maximum possible score for this submission",
    )
    tests_passed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of test cases passed",
    )
    total_tests: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total number of test cases evaluated",
    )
    execution_time: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Total execution time in seconds",
    )
    memory_used: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Peak memory used in megabytes (MB)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        index=True,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="submissions",
    )
    problem: Mapped["Problem"] = relationship(
        back_populates="submissions",
    )
    submission_results: Mapped[list["SubmissionResult"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
