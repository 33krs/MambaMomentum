# Imports all models so Alembic's autogenerate can discover them via Base.metadata.
from app.db.base_class import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.focus_session import FocusSession  # noqa: F401
from app.models.habit import Habit, HabitLog  # noqa: F401
from app.models.kanban import KanbanBoard, KanbanColumn, KanbanTask  # noqa: F401
from app.models.workout import (  # noqa: F401
    Exercise,
    WorkoutSession,
    WorkoutSet,
    WorkoutTemplate,
    WorkoutTemplateExercise,
)
