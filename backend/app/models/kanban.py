from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    and_,
    func,
)
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.user import User


KANBAN_COLUMNS = (
    ("pending", "Pendiente"),
    ("next", "Siguiente"),
    ("in_progress", "En curso"),
    ("testing", "Testeando"),
    ("done", "Hecho"),
)


class KanbanBoard(Base):
    __tablename__ = "kanban_boards"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="kanban_board")
    columns: Mapped[list["KanbanColumn"]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="KanbanColumn.position",
    )
    tasks: Mapped[list["KanbanTask"]] = relationship(
        back_populates="board", cascade="all, delete-orphan"
    )


class KanbanColumn(Base):
    __tablename__ = "kanban_columns"
    __table_args__ = (
        UniqueConstraint("board_id", "position", name="uq_kanban_columns_board_position"),
        UniqueConstraint("board_id", "key", name="uq_kanban_columns_board_key"),
        UniqueConstraint("board_id", "id", name="uq_kanban_columns_board_id"),
        CheckConstraint("position >= 0", name="ck_kanban_columns_position_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    board_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    board: Mapped["KanbanBoard"] = relationship(back_populates="columns")
    tasks: Mapped[list["KanbanTask"]] = relationship(
        back_populates="column",
        cascade="all, delete-orphan",
        order_by="KanbanTask.position",
        primaryjoin=lambda: and_(
            KanbanColumn.id == foreign(KanbanTask.column_id),
            KanbanColumn.board_id == KanbanTask.board_id,
        ),
    )


class KanbanTask(Base):
    __tablename__ = "kanban_tasks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["board_id", "column_id"],
            ["kanban_columns.board_id", "kanban_columns.id"],
            name="fk_kanban_tasks_column_in_board",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "board_id", "column_id", "position", name="uq_kanban_tasks_board_column_position"
        ),
        CheckConstraint(
            "char_length(title) BETWEEN 1 AND 120", name="ck_kanban_tasks_title_length"
        ),
        CheckConstraint(
            "description IS NULL OR char_length(description) <= 2000",
            name="ck_kanban_tasks_description_length",
        ),
        CheckConstraint(
            "background_color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_kanban_tasks_background_color"
        ),
        CheckConstraint("position >= 0", name="ck_kanban_tasks_position_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    board_id: Mapped[int] = mapped_column(
        ForeignKey("kanban_boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    column_id: Mapped[int] = mapped_column(nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    background_color: Mapped[str] = mapped_column(String(7), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    board: Mapped["KanbanBoard"] = relationship(back_populates="tasks")
    column: Mapped["KanbanColumn"] = relationship(
        back_populates="tasks",
        primaryjoin=lambda: and_(
            KanbanColumn.id == foreign(KanbanTask.column_id),
            KanbanColumn.board_id == KanbanTask.board_id,
        ),
    )
