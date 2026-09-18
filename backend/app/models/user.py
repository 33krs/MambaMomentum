from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.focus_session import FocusSession
    from app.models.habit import Habit
    from app.models.kanban import KanbanBoard
    from app.models.workout import WorkoutSession, WorkoutTemplate


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="UTC", server_default="UTC"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    focus_sessions: Mapped[list["FocusSession"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    workout_sessions: Mapped[list["WorkoutSession"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    workout_templates: Mapped[list["WorkoutTemplate"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    kanban_board: Mapped["KanbanBoard | None"] = relationship(
        back_populates="owner", cascade="all, delete-orphan", uselist=False
    )
    habits: Mapped[list["Habit"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
