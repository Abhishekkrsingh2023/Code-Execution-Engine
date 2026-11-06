import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import _utcnow

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.submission import Submission
    from app.models.user import User


class ContestStatus(str, enum.Enum):
    DRAFT = "draft"
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Contest(Base):
    __tablename__ = "contests"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="check_contest_end_after_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    status: Mapped[ContestStatus] = mapped_column(
        SAEnum(
            ContestStatus,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=ContestStatus.UPCOMING,
        nullable=False,
        index=True,
    )
    penalty_minutes: Mapped[int] = mapped_column(
        Integer,
        default=20,
        nullable=False,
        comment="Penalty in minutes added for each incorrect submission prior to solving",
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

    # Relationships
    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )
    contest_problems: Mapped[list["ContestProblem"]] = relationship(
        back_populates="contest",
        cascade="all, delete-orphan",
        order_by="ContestProblem.order_index",
        lazy="selectin",
    )
    participants: Mapped[list["ContestParticipant"]] = relationship(
        back_populates="contest",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="contest",
        cascade="all, delete-orphan",
    )

    @property
    def duration_seconds(self) -> int:
        """Returns the total duration of the contest in seconds."""
        return int((self.end_time - self.start_time).total_seconds())

    def get_effective_status(self, now: datetime | None = None) -> ContestStatus:
        """Determines the real-time lifecycle status of the contest.

        If the contest was explicitly marked as DRAFT or CANCELLED, that state is preserved.
        Otherwise, the status dynamically evaluates based on the current UTC time.
        """
        if self.status in (ContestStatus.DRAFT, ContestStatus.CANCELLED):
            return self.status

        current_time = now or datetime.now(UTC)
        if current_time < self.start_time:
            return ContestStatus.UPCOMING
        elif current_time > self.end_time:
            return ContestStatus.COMPLETED
        else:
            return ContestStatus.ACTIVE


class ContestProblem(Base):
    __tablename__ = "contest_problems"
    __table_args__ = (
        UniqueConstraint("contest_id", "problem_id", name="uq_contest_problem"),
        CheckConstraint("points > 0", name="check_positive_contest_problem_points"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    contest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    problem_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Problem ordering within the contest (e.g. 0 for Problem A, 1 for Problem B)",
    )
    points: Mapped[float] = mapped_column(
        Float,
        default=100.0,
        nullable=False,
        comment="Total points/weight allocated to this problem in the contest",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )

    # Relationships
    contest: Mapped["Contest"] = relationship(
        back_populates="contest_problems",
    )
    problem: Mapped["Problem"] = relationship(
        lazy="selectin",
    )


class ContestParticipant(Base):
    __tablename__ = "contest_participants"
    __table_args__ = (
        UniqueConstraint("contest_id", "user_id", name="uq_contest_participant"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    contest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )
    score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        index=True,
        comment="Total contest score achieved by participant",
    )
    problems_solved: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of distinct problems solved in this contest",
    )
    penalty_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total penalty time in seconds for tie-breaking",
    )
    rank: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Current or final contest leaderboard rank",
    )

    # Relationships
    contest: Mapped["Contest"] = relationship(
        back_populates="participants",
    )
    user: Mapped["User"] = relationship(
        lazy="selectin",
    )

