"""convert_contests_to_integer_id_and_icpc_schema

Revision ID: a1b2c3d4e5f6
Revises: 68183e60bf1f
Create Date: 2026-11-09 18:55:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "68183e60bf1f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Clean up old submissions contest_id foreign key & column
    op.drop_constraint("fk_submissions_contest_id_contests", "submissions", type_="foreignkey")
    op.drop_index(op.f("ix_submissions_contest_id"), table_name="submissions")
    op.drop_column("submissions", "contest_id")

    # 2. Drop old UUID-based contest tables
    op.drop_table("contest_problems")
    op.drop_table("contest_participants")
    op.drop_table("contests")

    # 3. Create new integer-ID contests table (status is dynamically derived in code, not stored)
    op.create_table(
        "contests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "penalty_minutes",
            sa.Integer(),
            nullable=False,
            server_default="20",
            comment="Penalty in minutes added for each incorrect submission prior to solving",
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("end_time > start_time", name="check_contest_end_after_start"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contests_created_by"), "contests", ["created_by"], unique=False)
    op.create_index(op.f("ix_contests_end_time"), "contests", ["end_time"], unique=False)
    op.create_index(op.f("ix_contests_start_time"), "contests", ["start_time"], unique=False)
    op.create_index(op.f("ix_contests_title"), "contests", ["title"], unique=False)

    # 4. Create new integer-ID contest_problems table with position
    op.create_table(
        "contest_problems",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False,
            comment="Problem order within the contest (1 for P1, 2 for P2, etc.)",
        ),
        sa.Column(
            "points",
            sa.Float(),
            nullable=False,
            server_default="100.0",
            comment="Total points allocated to this problem",
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("points > 0", name="check_positive_contest_problem_points"),
        sa.CheckConstraint("position > 0", name="check_positive_contest_problem_position"),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contest_id", "problem_id", name="uq_contest_problem"),
        sa.UniqueConstraint("contest_id", "position", name="uq_contest_position"),
    )
    op.create_index(
        op.f("ix_contest_problems_contest_id"), "contest_problems", ["contest_id"], unique=False
    )
    op.create_index(
        op.f("ix_contest_problems_problem_id"), "contest_problems", ["problem_id"], unique=False
    )
    op.create_index(
        "ix_contest_problems_contest_position",
        "contest_problems",
        ["contest_id", "position"],
        unique=False,
    )

    # 5. Create new integer-ID contest_participants table
    op.create_table(
        "contest_participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "score",
            sa.Float(),
            nullable=False,
            server_default="0.0",
            comment="Total contest score achieved by participant",
        ),
        sa.Column(
            "problems_solved",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Number of distinct problems solved",
        ),
        sa.Column(
            "penalty_seconds",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Total ICPC penalty time in seconds",
        ),
        sa.Column("rank", sa.Integer(), nullable=True, comment="Contest leaderboard rank"),
        sa.Column(
            "last_accepted_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp of last accepted submission for tie-breaking",
        ),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contest_id", "user_id", name="uq_contest_participant"),
    )
    op.create_index(
        op.f("ix_contest_participants_contest_id"),
        "contest_participants",
        ["contest_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contest_participants_user_id"), "contest_participants", ["user_id"], unique=False
    )
    op.create_index(
        "ix_contest_participants_leaderboard",
        "contest_participants",
        ["contest_id", "score", "problems_solved", "penalty_seconds"],
        unique=False,
    )

    # 6. Re-add contest_id as integer in submissions
    op.add_column("submissions", sa.Column("contest_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_submissions_contest_id"), "submissions", ["contest_id"], unique=False)
    op.create_index(
        "ix_submissions_contest_created", "submissions", ["contest_id", "created_at"], unique=False
    )
    op.create_foreign_key(
        "fk_submissions_contest_id_contests",
        "submissions",
        "contests",
        ["contest_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # 1. Drop foreign key and column from submissions
    op.drop_constraint("fk_submissions_contest_id_contests", "submissions", type_="foreignkey")
    op.drop_index("ix_submissions_contest_created", table_name="submissions")
    op.drop_index(op.f("ix_submissions_contest_id"), table_name="submissions")
    op.drop_column("submissions", "contest_id")

    # 2. Drop new integer tables
    op.drop_table("contest_problems")
    op.drop_table("contest_participants")
    op.drop_table("contests")

    # 3. Re-create original UUID-based tables
    op.create_table(
        "contests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "upcoming",
                "active",
                "completed",
                "cancelled",
                name="conteststatus",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("penalty_minutes", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("end_time > start_time", name="check_contest_end_after_start"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contests_created_by"), "contests", ["created_by"], unique=False)
    op.create_index(op.f("ix_contests_end_time"), "contests", ["end_time"], unique=False)
    op.create_index(op.f("ix_contests_start_time"), "contests", ["start_time"], unique=False)
    op.create_index(op.f("ix_contests_status"), "contests", ["status"], unique=False)
    op.create_index(op.f("ix_contests_title"), "contests", ["title"], unique=False)

    op.create_table(
        "contest_participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("problems_solved", sa.Integer(), nullable=False),
        sa.Column("penalty_seconds", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contest_id", "user_id", name="uq_contest_participant"),
    )
    op.create_index(
        op.f("ix_contest_participants_contest_id"),
        "contest_participants",
        ["contest_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contest_participants_score"), "contest_participants", ["score"], unique=False
    )
    op.create_index(
        op.f("ix_contest_participants_user_id"), "contest_participants", ["user_id"], unique=False
    )

    op.create_table(
        "contest_problems",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("points", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("points > 0", name="check_positive_contest_problem_points"),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contest_id", "problem_id", name="uq_contest_problem"),
    )
    op.create_index(
        op.f("ix_contest_problems_contest_id"), "contest_problems", ["contest_id"], unique=False
    )
    op.create_index(
        op.f("ix_contest_problems_problem_id"), "contest_problems", ["problem_id"], unique=False
    )

    op.add_column("submissions", sa.Column("contest_id", sa.UUID(), nullable=True))
    op.create_index(op.f("ix_submissions_contest_id"), "submissions", ["contest_id"], unique=False)
    op.create_foreign_key(
        "fk_submissions_contest_id_contests",
        "submissions",
        "contests",
        ["contest_id"],
        ["id"],
        ondelete="CASCADE",
    )
