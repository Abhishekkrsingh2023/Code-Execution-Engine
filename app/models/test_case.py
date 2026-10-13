from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.submission_result import SubmissionResult


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    problem_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("problems.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    input: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    expected_output: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    is_sample: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Flag indicating whether this is a sample/example test case shown to users",
    )
    weight: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
        comment="Weight/score assigned to this test case",
    )

    # Relationships
    problem: Mapped["Problem"] = relationship(
        back_populates="test_cases",
    )
    submission_results: Mapped[list["SubmissionResult"]] = relationship(
        back_populates="test_case",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
