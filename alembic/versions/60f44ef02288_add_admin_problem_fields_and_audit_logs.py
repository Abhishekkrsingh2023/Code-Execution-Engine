"""add_admin_problem_fields_and_audit_logs

Revision ID: 60f44ef02288
Revises: b9feca34ad23
Create Date: 2026-10-14 00:05:58.465391

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "60f44ef02288"
down_revision: str | Sequence[str] | None = "b9feca34ad23"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # ── 1. Users additions ──
    op.add_column(
        "users",
        sa.Column(
            "status",
            sa.Enum("active", "inactive", "suspended", name="userstatus", native_enum=False),
            server_default="active",
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_users_status"), "users", ["status"], unique=False)
    op.add_column(
        "users",
        sa.Column("is_protected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    # ── 2. Problems additions ──
    op.add_column(
        "problems",
        sa.Column("category", sa.String(length=100), server_default="General", nullable=False),
    )
    op.create_index(op.f("ix_problems_category"), "problems", ["category"], unique=False)

    op.add_column(
        "problems",
        sa.Column("topic", sa.String(length=100), server_default="General", nullable=False),
    )
    op.create_index(op.f("ix_problems_topic"), "problems", ["topic"], unique=False)

    op.add_column(
        "problems",
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "published",
                "unpublished",
                "archived",
                name="problemstatus",
                native_enum=False,
            ),
            server_default="published",
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_problems_status"), "problems", ["status"], unique=False)

    op.add_column("problems", sa.Column("created_by", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_problems_created_by_users",
        "problems",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_problems_created_by"), "problems", ["created_by"], unique=False)

    op.add_column(
        "problems",
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    op.add_column(
        "problems",
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_index(op.f("ix_problems_is_deleted"), "problems", ["is_deleted"], unique=False)

    op.add_column("problems", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    # ── 3. Audit logs table ──
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_username", sa.String(length=50), nullable=True),
        sa.Column("actor_role", sa.String(length=50), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="success", nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_actor_id"), "audit_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_actor_role"), "audit_logs", ["actor_role"], unique=False)
    op.create_index(
        op.f("ix_audit_logs_actor_username"), "audit_logs", ["actor_username"], unique=False
    )
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_status"), "audit_logs", ["status"], unique=False)
    op.create_index(op.f("ix_audit_logs_target_id"), "audit_logs", ["target_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_target_type"), "audit_logs", ["target_type"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_problems_is_deleted"), table_name="problems")
    op.drop_column("problems", "deleted_at")
    op.drop_column("problems", "is_deleted")
    op.drop_column("problems", "updated_at")
    op.drop_index(op.f("ix_problems_created_by"), table_name="problems")
    op.drop_constraint("fk_problems_created_by_users", "problems", type_="foreignkey")
    op.drop_column("problems", "created_by")
    op.drop_index(op.f("ix_problems_status"), table_name="problems")
    op.drop_column("problems", "status")
    op.drop_index(op.f("ix_problems_topic"), table_name="problems")
    op.drop_column("problems", "topic")
    op.drop_index(op.f("ix_problems_category"), table_name="problems")
    op.drop_column("problems", "category")

    op.drop_column("users", "is_protected")
    op.drop_index(op.f("ix_users_status"), table_name="users")
    op.drop_column("users", "status")
