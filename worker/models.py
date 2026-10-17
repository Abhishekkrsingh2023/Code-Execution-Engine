import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


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

class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    otp: Mapped[str | None] = mapped_column(
        String(6),
        nullable=True,
    )
    otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=UserRole.USER,
        nullable=False,
    )
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=UserStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_protected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    total_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        index=True,
    )
    problems_solved: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )

    @property
    def has_password(self) -> bool:
        """Returns True if the user has a password set, False if passwordless/OTP-only."""
        return self.password_hash is not None

    @property
    def is_verified(self) -> bool:
        """Returns True if user's email address has been verified."""
        return self.is_email_verified




class ProblemDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ProblemStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    ARCHIVED = "archived"


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    difficulty: Mapped[ProblemDifficulty] = mapped_column(
        SAEnum(
            ProblemDifficulty, native_enum=False, values_callable=lambda x: [e.value for e in x]
        ),
        default=ProblemDifficulty.EASY,
        index=True,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(100),
        default="General",
        nullable=False,
        index=True,
    )
    topic: Mapped[str] = mapped_column(
        String(100),
        default="General",
        nullable=False,
        index=True,
        comment="Topic/tag for the problem (e.g. array, tree, linkedlist, recursion)",
    )
    status: Mapped[ProblemStatus] = mapped_column(
        SAEnum(ProblemStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=ProblemStatus.PUBLISHED,
        nullable=False,
        index=True,
    )
    time_limit: Mapped[float] = mapped_column(
        Float,
        default=2.0,
        nullable=False,
        comment="Execution time limit in seconds",
    )
    memory_limit: Mapped[int] = mapped_column(
        Integer,
        default=256,
        nullable=False,
        comment="Execution memory limit in megabytes (MB)",
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


    @property
    def problem_code(self) -> int | None:
        """Returns the integer problem code matching problem.id."""
        return self.id

    @property
    def problem_id(self) -> int | None:
        """Alias for id to ensure consistency across problem references."""
        return self.id
