"""add user timezone and habit log date index

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
    )
    op.create_index("ix_habit_logs_date", "habit_logs", ["date"])


def downgrade() -> None:
    op.drop_index("ix_habit_logs_date", table_name="habit_logs")
    op.drop_column("users", "timezone")
