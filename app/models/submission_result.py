import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Enum as SAEnum, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.submission import Submission
    from app.models.test_case import TestCase


class JudgeStatus(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    MEMORY_LIMIT_EXCEEDED = "memory_limit_exceeded"
    RUNTIME_ERROR = "runtime_error"
    COMPILATION_ERROR = "compilation_error"


class SubmissionResult(Base):
    __tablename__ = "submission_results"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    test_case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("test_cases.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[JudgeStatus] = mapped_column(
        SAEnum(JudgeStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=JudgeStatus.PASSED,
        nullable=False,
    )
    execution_time: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Execution time for this testcase in seconds",
    )
    memory_used: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Memory used for this testcase in megabytes (MB)",
    )

    # Relationships
    submission: Mapped["Submission"] = relationship(
        back_populates="submission_results",
    )
    test_case: Mapped["TestCase"] = relationship(
        back_populates="submission_results",
    )
