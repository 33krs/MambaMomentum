"""exercise edit/delete snapshot + workout templates

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- workout_sets: snapshot del nombre del ejercicio + FK nullable con SET NULL ---
    op.add_column("workout_sets", sa.Column("exercise_name", sa.String(length=150), nullable=True))
    op.execute(
        """
        UPDATE workout_sets
        SET exercise_name = exercises.name
        FROM exercises
        WHERE workout_sets.exercise_id = exercises.id
        """
    )
    op.execute("UPDATE workout_sets SET exercise_name = '' WHERE exercise_name IS NULL")
    op.alter_column("workout_sets", "exercise_name", nullable=False)

    op.drop_constraint("workout_sets_exercise_id_fkey", "workout_sets", type_="foreignkey")
    op.alter_column("workout_sets", "exercise_id", nullable=True)
    op.create_foreign_key(
        "workout_sets_exercise_id_fkey",
        "workout_sets",
        "exercises",
        ["exercise_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- workout_templates ---
    op.create_table(
        "workout_templates",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_workout_templates_user_id", "workout_templates", ["user_id"])

    op.create_table(
        "workout_template_exercises",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("workout_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("exercise_id", sa.Integer(), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("sets_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_workout_template_exercises_template_id", "workout_template_exercises", ["template_id"]
    )
    op.create_index(
        "ix_workout_template_exercises_exercise_id", "workout_template_exercises", ["exercise_id"]
    )


def downgrade() -> None:
    op.drop_table("workout_template_exercises")
    op.drop_table("workout_templates")

    op.drop_constraint("workout_sets_exercise_id_fkey", "workout_sets", type_="foreignkey")
    op.alter_column("workout_sets", "exercise_id", nullable=False)
    op.create_foreign_key(
        "workout_sets_exercise_id_fkey", "workout_sets", "exercises", ["exercise_id"], ["id"]
    )
    op.drop_column("workout_sets", "exercise_name")
