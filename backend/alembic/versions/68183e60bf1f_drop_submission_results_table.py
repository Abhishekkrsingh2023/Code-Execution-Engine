"""drop_submission_results_table

Revision ID: 68183e60bf1f
Revises: 0c5268faa004
Create Date: 2026-11-07 12:58:47.735244

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "68183e60bf1f"
down_revision: str | Sequence[str] | None = "0c5268faa004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - drop unused submission_results table and its indexes."""
    op.drop_index(op.f("ix_submission_results_test_case_id"), table_name="submission_results")
    op.drop_index(op.f("ix_submission_results_submission_id"), table_name="submission_results")
    op.drop_table("submission_results")


def downgrade() -> None:
    """Downgrade schema - recreate submission_results table and its indexes."""
    op.create_table(
        "submission_results",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("submission_id", sa.UUID(), nullable=False),
        sa.Column("test_case_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "passed",
                "failed",
                "time_limit_exceeded",
                "memory_limit_exceeded",
                "runtime_error",
                "compilation_error",
                name="judgestatus",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0.0"),
            comment="Score earned for this testcase",
        ),
        sa.Column(
            "max_score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("1.0"),
            comment="Max score weight for this testcase",
        ),
        sa.Column(
            "execution_time",
            sa.Float(),
            nullable=True,
            comment="Execution time for this testcase in seconds",
        ),
        sa.Column(
            "memory_used",
            sa.Float(),
            nullable=True,
            comment="Memory used for this testcase in megabytes (MB)",
        ),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["test_case_id"], ["test_cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_submission_results_submission_id"),
        "submission_results",
        ["submission_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_submission_results_test_case_id"),
        "submission_results",
        ["test_case_id"],
        unique=False,
    )
