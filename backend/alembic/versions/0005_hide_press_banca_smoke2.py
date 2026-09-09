"""hide the retired system exercise without severing historical references

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exercises",
        sa.Column("catalog_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute(
        sa.text(
            """
            UPDATE exercises
            SET catalog_visible = FALSE
            WHERE owner_id IS NULL AND lower(name) = lower('Press Banca Smoke2')
            """
        )
    )
    op.alter_column("exercises", "catalog_visible", server_default=None)


def downgrade() -> None:
    op.drop_column("exercises", "catalog_visible")
