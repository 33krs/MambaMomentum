"""install the canonical system exercise catalog and retain referenced history

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SYSTEM_EXERCISES = (
    "Press de banca", "Sentadillas", "Peso muerto", "Dominadas", "Press militar",
    "Remo con barra", "Curl de bíceps", "Extensiones de tríceps", "Prensa de piernas",
    "Elevaciones laterales", "Fondos en paralelas", "Zancadas", "Jalón al pecho",
    "Hip thrust", "Plancha abdominal", "Elevaciones de talones",
    "Curl de isquiotibiales", "Press francés",
)


def upgrade() -> None:
    # Upsert makes fresh installations receive the catalog and keeps existing canonical rows.
    for name in SYSTEM_EXERCISES:
        op.execute(
            sa.text("""
                INSERT INTO exercises (name, owner_id)
                SELECT :name, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM exercises WHERE owner_id IS NULL AND lower(name) = lower(:name)
                )
            """).bindparams(name=name)
        )

    # Never remove a historical/template reference: it would turn a live catalog choice
    # into a null FK. These legacy rows are intentionally retained for old records.
    op.execute(
        sa.text("""
            DELETE FROM exercises
            WHERE owner_id IS NULL
              AND lower(name) <> ALL(:catalog)
              AND NOT EXISTS (SELECT 1 FROM workout_sets WHERE workout_sets.exercise_id = exercises.id)
              AND NOT EXISTS (
                  SELECT 1 FROM workout_template_exercises
                  WHERE workout_template_exercises.exercise_id = exercises.id
              )
        """).bindparams(catalog=[name.lower() for name in SYSTEM_EXERCISES])
    )


def downgrade() -> None:
    op.execute(
        sa.text("""
            DELETE FROM exercises
            WHERE owner_id IS NULL
              AND lower(name) = ANY(:catalog)
              AND NOT EXISTS (SELECT 1 FROM workout_sets WHERE workout_sets.exercise_id = exercises.id)
              AND NOT EXISTS (
                  SELECT 1 FROM workout_template_exercises
                  WHERE workout_template_exercises.exercise_id = exercises.id
              )
        """).bindparams(catalog=[name.lower() for name in SYSTEM_EXERCISES])
    )