import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import _utcnow

if TYPE_CHECKING:
    from app.models.submission import Submission
    from app.models.test_case import TestCase
    from app.models.user import User


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

    # Relationships
    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    # Relationships
    test_cases: Mapped[list["TestCase"]] = relationship(
        back_populates="problem",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="problem",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def problem_code(self) -> int | None:
        """Returns the integer problem code matching problem.id."""
        return self.id

    @property
    def problem_id(self) -> int | None:
        """Alias for id to ensure consistency across problem references."""
        return self.id


