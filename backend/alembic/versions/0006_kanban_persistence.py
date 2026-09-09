"""add personal kanban persistence

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kanban_boards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_kanban_boards_user_id"),
    )
    op.create_index("ix_kanban_boards_user_id", "kanban_boards", ["user_id"])

    op.create_table(
        "kanban_columns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "board_id",
            sa.Integer(),
            sa.ForeignKey("kanban_boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_kanban_columns_position_nonnegative"),
        sa.UniqueConstraint("board_id", "position", name="uq_kanban_columns_board_position"),
        sa.UniqueConstraint("board_id", "key", name="uq_kanban_columns_board_key"),
        sa.UniqueConstraint("board_id", "id", name="uq_kanban_columns_board_id"),
    )
    op.create_index("ix_kanban_columns_board_id", "kanban_columns", ["board_id"])

    op.create_table(
        "kanban_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "board_id",
            sa.Integer(),
            sa.ForeignKey("kanban_boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("background_color", sa.String(length=7), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 120", name="ck_kanban_tasks_title_length"
        ),
        sa.CheckConstraint(
            "description IS NULL OR char_length(description) <= 2000",
            name="ck_kanban_tasks_description_length",
        ),
        sa.CheckConstraint(
            "background_color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_kanban_tasks_background_color"
        ),
        sa.CheckConstraint("position >= 0", name="ck_kanban_tasks_position_nonnegative"),
        sa.ForeignKeyConstraint(
            ["board_id", "column_id"],
            ["kanban_columns.board_id", "kanban_columns.id"],
            name="fk_kanban_tasks_column_in_board",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "board_id", "column_id", "position", name="uq_kanban_tasks_board_column_position"
        ),
    )
    op.create_index("ix_kanban_tasks_board_id", "kanban_tasks", ["board_id"])
    op.create_index("ix_kanban_tasks_column_id", "kanban_tasks", ["column_id"])

    op.execute(
        """
        INSERT INTO kanban_boards (user_id)
        SELECT id FROM users
        ON CONFLICT (user_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO kanban_columns (board_id, key, name, position)
        SELECT board.id, initial_column.key, initial_column.name, initial_column.position
        FROM kanban_boards AS board
        CROSS JOIN (
            VALUES
                ('pending', 'Pendiente', 0),
                ('next', 'Siguiente', 1),
                ('in_progress', 'En curso', 2),
                ('testing', 'Testeando', 3),
                ('done', 'Hecho', 4)
        ) AS initial_column(key, name, position)
        ON CONFLICT (board_id, key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_kanban_tasks_column_id", table_name="kanban_tasks")
    op.drop_index("ix_kanban_tasks_board_id", table_name="kanban_tasks")
    op.drop_table("kanban_tasks")
    op.drop_index("ix_kanban_columns_board_id", table_name="kanban_columns")
    op.drop_table("kanban_columns")
    op.drop_index("ix_kanban_boards_user_id", table_name="kanban_boards")
    op.drop_table("kanban_boards")
