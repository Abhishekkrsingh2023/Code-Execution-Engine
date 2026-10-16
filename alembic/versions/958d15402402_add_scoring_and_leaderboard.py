"""add_scoring_and_leaderboard

Revision ID: 958d15402402
Revises: bbb685fab409
Create Date: 2026-10-16 22:17:32.731249

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "958d15402402"
down_revision: str | Sequence[str] | None = "bbb685fab409"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "submission_results",
        sa.Column(
            "score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0.0"),
            comment="Score earned for this testcase",
        ),
    )
    op.add_column(
        "submission_results",
        sa.Column(
            "max_score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("1.0"),
            comment="Max score weight for this testcase",
        ),
    )
    op.add_column("submissions", sa.Column("problem_name", sa.String(length=255), nullable=True))
    op.add_column(
        "submissions",
        sa.Column(
            "score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0.0"),
            comment="Total score earned on this submission based on passed tests",
        ),
    )
    op.add_column(
        "submissions",
        sa.Column(
            "max_score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0.0"),
            comment="Maximum possible score for this submission",
        ),
    )
    op.add_column(
        "submissions",
        sa.Column(
            "tests_passed",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Number of test cases passed",
        ),
    )
    op.add_column(
        "submissions",
        sa.Column(
            "total_tests",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Total number of test cases evaluated",
        ),
    )
    op.alter_column("submissions", "user_id", existing_type=sa.UUID(), nullable=True)
    op.alter_column("submissions", "problem_id", existing_type=sa.INTEGER(), nullable=True)
    op.add_column(
        "users", sa.Column("total_score", sa.Float(), nullable=False, server_default=sa.text("0.0"))
    )
    op.add_column(
        "users",
        sa.Column("problems_solved", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index(op.f("ix_users_total_score"), "users", ["total_score"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_users_total_score"), table_name="users")
    op.drop_column("users", "problems_solved")
    op.drop_column("users", "total_score")
    op.alter_column("submissions", "problem_id", existing_type=sa.INTEGER(), nullable=False)
    op.alter_column("submissions", "user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("submissions", "total_tests")
    op.drop_column("submissions", "tests_passed")
    op.drop_column("submissions", "max_score")
    op.drop_column("submissions", "score")
    op.drop_column("submissions", "problem_name")
    op.drop_column("submission_results", "max_score")
    op.drop_column("submission_results", "score")
