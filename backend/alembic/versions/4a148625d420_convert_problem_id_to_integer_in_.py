"""convert_problem_id_to_integer_in_problem_templates

Revision ID: 4a148625d420
Revises: b020ce789568
Create Date: 2026-10-17 12:02:05.954186

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4a148625d420"
down_revision: str | Sequence[str] | None = "b020ce789568"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("problem_templates_problem_id_fkey", "problem_templates", type_="foreignkey")
    op.alter_column(
        "common_problem_templates",
        "problem_id",
        existing_type=sa.VARCHAR(length=4),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="problem_id::integer",
    )
    op.alter_column(
        "problem_templates",
        "problem_id",
        existing_type=sa.VARCHAR(length=4),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="problem_id::integer",
    )
    op.create_foreign_key(
        "problem_templates_problem_id_fkey",
        "problem_templates",
        "common_problem_templates",
        ["problem_id"],
        ["problem_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("problem_templates_problem_id_fkey", "problem_templates", type_="foreignkey")
    op.alter_column(
        "problem_templates",
        "problem_id",
        existing_type=sa.Integer(),
        type_=sa.VARCHAR(length=4),
        existing_nullable=False,
        postgresql_using="lpad(problem_id::text, 4, '0')",
    )
    op.alter_column(
        "common_problem_templates",
        "problem_id",
        existing_type=sa.Integer(),
        type_=sa.VARCHAR(length=4),
        existing_nullable=False,
        postgresql_using="lpad(problem_id::text, 4, '0')",
    )
    op.create_foreign_key(
        "problem_templates_problem_id_fkey",
        "problem_templates",
        "common_problem_templates",
        ["problem_id"],
        ["problem_id"],
        ondelete="CASCADE",
    )
