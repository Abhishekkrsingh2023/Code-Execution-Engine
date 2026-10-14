"""replace_user_code_and_main_code_with_boilerplate_code

Revision ID: bbb685fab409
Revises: 60f44ef02288
Create Date: 2026-10-15 00:25:44.525461

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bbb685fab409'
down_revision: Union[str, Sequence[str], None] = '60f44ef02288'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Replace user_code and main_code with boilerplate_code in problem_templates."""
    op.add_column("problem_templates", sa.Column("boilerplate_code", sa.Text(), nullable=True))
    op.execute("UPDATE problem_templates SET boilerplate_code = user_code WHERE boilerplate_code IS NULL")
    op.drop_column("problem_templates", "user_code")
    op.drop_column("problem_templates", "main_code")


def downgrade() -> None:
    """Downgrade schema: Restore user_code and main_code in problem_templates."""
    op.add_column("problem_templates", sa.Column("user_code", sa.Text(), server_default="", nullable=False))
    op.add_column("problem_templates", sa.Column("main_code", sa.Text(), server_default="", nullable=False))
    op.execute("UPDATE problem_templates SET user_code = COALESCE(boilerplate_code, '')")
    op.drop_column("problem_templates", "boilerplate_code")

