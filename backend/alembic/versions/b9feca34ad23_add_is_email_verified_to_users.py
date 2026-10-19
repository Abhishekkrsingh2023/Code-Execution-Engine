"""add is_email_verified to users

Revision ID: b9feca34ad23
Revises: 3ddf460e90f6
Create Date: 2026-10-12 22:22:35.066144

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b9feca34ad23"
down_revision: str | Sequence[str] | None = "3ddf460e90f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users",
        sa.Column(
            "is_email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    # Mark pre-existing active users without pending OTP as email verified
    op.execute("UPDATE users SET is_email_verified = true WHERE otp IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "is_email_verified")
