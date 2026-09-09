"""add exercise ownership and enforce valid focus ranges

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-08

Existing exercises become read-only system exercises. Before the new indexes are
installed, legacy names are whitespace-normalized, blank names become the stable
`Legacy Exercise <id>` form, and case-insensitive duplicates are merged into the
lowest-id row. Foreign keys are repointed while workout name snapshots remain
unchanged. Template snapshots follow the retained catalog name. Invalid focus
sessions are repaired to a one-minute duration before the database constraint.
Downgrading removes custom exercises and template items whose exercise no longer
exists because the previous schema cannot represent either state.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_exercise_name", "exercises", type_="unique")
    op.execute(
        """
        UPDATE exercises
        SET name = btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))
        """
    )
    op.execute(
        """
        UPDATE exercises
        SET name = 'Legacy Exercise ' || id
        WHERE name = ''
        """
    )
    op.execute(
        """
        CREATE TEMPORARY TABLE exercise_merge_map ON COMMIT DROP AS
        SELECT id AS duplicate_id, canonical_id
        FROM (
            SELECT
                id,
                min(id) OVER (PARTITION BY lower(name)) AS canonical_id
            FROM exercises
        ) AS ranked
        WHERE id <> canonical_id
        """
    )
    op.execute(
        """
        UPDATE workout_sets AS workout_set
        SET exercise_id = merge_map.canonical_id
        FROM exercise_merge_map AS merge_map
        WHERE workout_set.exercise_id = merge_map.duplicate_id
        """
    )
    op.execute(
        """
        UPDATE workout_template_exercises AS item
        SET exercise_id = merge_map.canonical_id
        FROM exercise_merge_map AS merge_map
        WHERE item.exercise_id = merge_map.duplicate_id
        """
    )
    op.execute(
        """
        DELETE FROM exercises AS exercise
        USING exercise_merge_map AS merge_map
        WHERE exercise.id = merge_map.duplicate_id
        """
    )

    op.add_column("exercises", sa.Column("owner_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "exercises_owner_id_fkey",
        "exercises",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_exercises_owner_id", "exercises", ["owner_id"])
    op.create_check_constraint(
        "ck_exercises_name_not_blank",
        "exercises",
        "name ~ '[^[:space:]]'",
    )
    op.create_index(
        "uq_exercises_system_name_ci",
        "exercises",
        [sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("owner_id IS NULL"),
    )
    op.create_index(
        "uq_exercises_owner_name_ci",
        "exercises",
        ["owner_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("owner_id IS NOT NULL"),
    )

    op.add_column(
        "workout_template_exercises",
        sa.Column("exercise_name", sa.String(length=150), nullable=True),
    )
    op.execute(
        """
        UPDATE workout_template_exercises AS item
        SET exercise_name = exercises.name
        FROM exercises
        WHERE item.exercise_id = exercises.id
        """
    )
    op.execute(
        "UPDATE workout_template_exercises SET exercise_name = '' " "WHERE exercise_name IS NULL"
    )
    op.alter_column("workout_template_exercises", "exercise_name", nullable=False)
    op.drop_constraint(
        "workout_template_exercises_exercise_id_fkey",
        "workout_template_exercises",
        type_="foreignkey",
    )
    op.alter_column("workout_template_exercises", "exercise_id", nullable=True)
    op.create_foreign_key(
        "workout_template_exercises_exercise_id_fkey",
        "workout_template_exercises",
        "exercises",
        ["exercise_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE focus_sessions
        SET end_time = start_time + INTERVAL '1 minute', duration_minutes = 1
        WHERE end_time <= start_time
        """
    )
    op.create_check_constraint(
        "ck_focus_sessions_valid_time_range",
        "focus_sessions",
        "end_time > start_time",
    )


def downgrade() -> None:
    op.drop_constraint("ck_focus_sessions_valid_time_range", "focus_sessions", type_="check")

    op.execute("DELETE FROM exercises WHERE owner_id IS NOT NULL")
    op.execute("DELETE FROM workout_template_exercises WHERE exercise_id IS NULL")

    op.drop_constraint(
        "workout_template_exercises_exercise_id_fkey",
        "workout_template_exercises",
        type_="foreignkey",
    )
    op.alter_column("workout_template_exercises", "exercise_id", nullable=False)
    op.create_foreign_key(
        "workout_template_exercises_exercise_id_fkey",
        "workout_template_exercises",
        "exercises",
        ["exercise_id"],
        ["id"],
    )
    op.drop_column("workout_template_exercises", "exercise_name")

    op.drop_index("uq_exercises_owner_name_ci", table_name="exercises")
    op.drop_index("uq_exercises_system_name_ci", table_name="exercises")
    op.drop_constraint("ck_exercises_name_not_blank", "exercises", type_="check")
    op.create_unique_constraint("uq_exercise_name", "exercises", ["name"])
    op.drop_index("ix_exercises_owner_id", table_name="exercises")
    op.drop_constraint("exercises_owner_id_fkey", "exercises", type_="foreignkey")
    op.drop_column("exercises", "owner_id")
