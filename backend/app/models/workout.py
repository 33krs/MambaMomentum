from datetime import date as date_type
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.user import User


class Exercise(Base):
    """A shared system exercise or a private user-owned exercise."""

    __tablename__ = "exercises"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    muscle_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    catalog_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("name ~ '[^[:space:]]'", name="ck_exercises_name_not_blank"),
        Index(
            "uq_exercises_system_name_ci",
            func.lower(name),
            unique=True,
            postgresql_where=owner_id.is_(None),
        ),
        Index(
            "uq_exercises_owner_name_ci",
            owner_id,
            func.lower(name),
            unique=True,
            postgresql_where=owner_id.is_not(None),
        ),
    )

    sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="exercise")

    @property
    def is_system(self) -> bool:
        return self.owner_id is None


class WorkoutSession(Base):
    """Sesión de entrenamiento de fuerza compuesta por múltiples series."""

    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(150), nullable=False, default="Entrenamiento")
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="workout_sessions")
    sets: Mapped[list["WorkoutSet"]] = relationship(
        back_populates="workout_session",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.set_number",
    )


class WorkoutSet(Base):
    """Estructura paramétrica de una serie: ejercicio, repeticiones, peso y esfuerzo.

    `exercise_name` es una copia del nombre del ejercicio en el momento en que se
    registró la serie: si el ejercicio se borra del catálogo más adelante, el
    historial y las estadísticas siguen mostrando con qué ejercicio se hizo.
    """

    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    workout_session_id: Mapped[int] = mapped_column(
        ForeignKey("workout_sessions.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[int | None] = mapped_column(
        ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    exercise_name: Mapped[str] = mapped_column(String(150), nullable=False)

    set_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    rpe: Mapped[float | None] = mapped_column(Float, nullable=True)

    workout_session: Mapped["WorkoutSession"] = relationship(back_populates="sets")
    exercise: Mapped["Exercise | None"] = relationship(back_populates="sets")


class WorkoutTemplate(Base):
    """Plantilla reutilizable de entrenamiento: ejercicios y número de series por ejercicio."""

    __tablename__ = "workout_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="workout_templates")
    items: Mapped[list["WorkoutTemplateExercise"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="WorkoutTemplateExercise.order_index",
    )


class WorkoutTemplateExercise(Base):
    """Línea de una plantilla: un ejercicio y cuántas series se hacen de él."""

    __tablename__ = "workout_template_exercises"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("workout_templates.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[int | None] = mapped_column(
        ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    exercise_name: Mapped[str] = mapped_column(String(150), nullable=False)

    sets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped["WorkoutTemplate"] = relationship(back_populates="items")
    exercise: Mapped["Exercise | None"] = relationship()
