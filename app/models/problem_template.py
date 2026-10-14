from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import _utcnow


class CommonProblemTemplate(Base):
    __tablename__ = "common_problem_templates"

    problem_id: Mapped[str] = mapped_column(String(4), primary_key=True)
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False)
    run_test_cases: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    time_limit: Mapped[float] = mapped_column(Float, default=2.0)
    submit_test_cases: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    templates: Mapped[list["ProblemTemplate"]] = relationship(
        back_populates="common",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class ProblemTemplate(Base):
    __tablename__ = "problem_templates"

    problem_id: Mapped[str] = mapped_column(
        String(4),
        ForeignKey("common_problem_templates.problem_id", ondelete="CASCADE"),
        primary_key=True,
    )
    language: Mapped[str] = mapped_column(String(20), primary_key=True)
    boilerplate_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    common: Mapped["CommonProblemTemplate"] = relationship(back_populates="templates")
