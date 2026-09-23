from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def _utcnow() -> datetime:
    """Return the current time in UTC (timezone-aware). Use this instead of
    datetime.now() (naive) or datetime.utcnow() (deprecated in Python 3.12+)."""
    return datetime.now(timezone.utc)


class CommonProblemTemplate(Base):
    __tablename__ = "common_problem_templates"

    problem_id: Mapped[str] = mapped_column(String(4), primary_key=True)
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False)
    run_test_cases: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    time_limit: Mapped[float] = mapped_column(Float, default=2.0)
    submit_test_cases: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # DateTime(timezone=True) stores TIMESTAMPTZ in Postgres — avoids silent
    # timezone-stripping that DateTime without timezone causes.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    templates: Mapped[list["ProblemTemplate"]] = relationship(
        back_populates="common",
        passive_deletes=True,   # trust the DB's ON DELETE CASCADE, don't pre-fetch/delete manually
    )


class ProblemTemplate(Base):
    __tablename__ = "problem_templates"

    problem_id: Mapped[str] = mapped_column(
        String(4),
        ForeignKey("common_problem_templates.problem_id", ondelete="CASCADE"),
        primary_key=True,
    )
    language: Mapped[str] = mapped_column(String(20), primary_key=True)
    user_code: Mapped[str] = mapped_column(Text, nullable=False)
    main_code: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    common: Mapped["CommonProblemTemplate"] = relationship(back_populates="templates")