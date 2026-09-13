"""Transactional application service for authenticated Kanban operations."""

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.crud.crud_kanban import (
    create_task,
    delete_task,
    get_board,
    get_column,
    get_locked_board,
    get_or_create_board,
    get_task,
    list_column_tasks,
    update_task,
)
from app.models.kanban import KanbanBoard, KanbanColumn, KanbanTask
from app.schemas.kanban import KanbanTaskCreate, KanbanTaskMove, KanbanTaskUpdate


class KanbanNotFoundError(Exception):
    """A Kanban resource is absent or outside the authenticated user's scope."""


class KanbanInvalidPositionError(Exception):
    """A requested insertion position is outside the destination column."""


class KanbanService:
    """Own atomic Kanban mutations and return an authoritative post-commit board state."""

    def __init__(self, db: Session):
        self.db = db

    def read_board(self, user_id: int) -> KanbanBoard:
        board = get_board(self.db, user_id)
        if board is None:
            get_or_create_board(self.db, user_id)
            self.db.commit()
            board = get_board(self.db, user_id)
        return board

    def read_task(self, user_id: int, task_id: int) -> KanbanTask:
        task = get_task(self.db, task_id, user_id)
        if task is None:
            raise KanbanNotFoundError
        return task

    def create_task(self, user_id: int, task_in: KanbanTaskCreate) -> KanbanBoard:
        def operation(board: KanbanBoard) -> None:
            column = self._owned_column(board, task_in.column_id)
            tasks = list_column_tasks(self.db, board.id, column.id)
            self._validate_position(task_in.position, len(tasks))
            task = create_task(
                self.db,
                user_id,
                column.id,
                task_in.title,
                task_in.background_color,
                self._temporary_position(tasks),
                task_in.description,
            )
            if task is None:
                raise KanbanNotFoundError
            tasks.insert(task_in.position, task)
            self._normalize_columns([tasks])

        return self._mutate(user_id, operation)

    def update_task(self, user_id: int, task_id: int, task_in: KanbanTaskUpdate) -> KanbanBoard:
        def operation(board: KanbanBoard) -> None:
            task = self._owned_task(task_id, user_id)
            update_task(self.db, task, **task_in.model_dump(exclude_unset=True))

        return self._mutate(user_id, operation)

    def move_task(self, user_id: int, task_id: int, move_in: KanbanTaskMove) -> KanbanBoard:
        def operation(board: KanbanBoard) -> None:
            task = self._owned_task(task_id, user_id)
            destination = self._owned_column(board, move_in.column_id)
            source_tasks = list_column_tasks(self.db, board.id, task.column_id)
            destination_tasks = (
                source_tasks
                if task.column_id == destination.id
                else list_column_tasks(self.db, board.id, destination.id)
            )
            source_without_task = [item for item in source_tasks if item.id != task.id]
            destination_without_task = [item for item in destination_tasks if item.id != task.id]
            self._validate_position(move_in.position, len(destination_without_task))

            if task.column_id == destination.id:
                reordered = destination_without_task
                reordered.insert(move_in.position, task)
                self._normalize_columns([reordered])
                return

            destination_without_task.insert(move_in.position, task)
            self._stage_tasks(source_without_task + destination_without_task)
            task.column_id = destination.id
            self.db.flush()
            self._assign_positions(source_without_task)
            self._assign_positions(destination_without_task)
            self.db.flush()

        return self._mutate(user_id, operation)

    def delete_task(self, user_id: int, task_id: int) -> KanbanBoard:
        def operation(board: KanbanBoard) -> None:
            task = self._owned_task(task_id, user_id)
            remaining = [
                item
                for item in list_column_tasks(self.db, board.id, task.column_id)
                if item.id != task.id
            ]
            delete_task(self.db, task)
            self._normalize_columns([remaining])

        return self._mutate(user_id, operation)

    def _mutate(self, user_id: int, operation: Callable[[KanbanBoard], None]) -> KanbanBoard:
        try:
            board = get_locked_board(self.db, user_id)
            if board is None:
                raise KanbanNotFoundError
            operation(board)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return self.read_board(user_id)

    def _owned_column(self, board: KanbanBoard, column_id: int) -> KanbanColumn:
        column = get_column(self.db, board.id, column_id)
        if column is None:
            raise KanbanNotFoundError
        return column

    def _owned_task(self, task_id: int, user_id: int) -> KanbanTask:
        task = get_task(self.db, task_id, user_id)
        if task is None:
            raise KanbanNotFoundError
        return task

    @staticmethod
    def _validate_position(position: int, size: int) -> None:
        if position > size:
            raise KanbanInvalidPositionError

    def _temporary_position(self, tasks: list[KanbanTask]) -> int:
        return max((task.position for task in tasks), default=-1) + 1

    def _normalize_columns(self, columns: list[list[KanbanTask]]) -> None:
        tasks = [task for column in columns for task in column]
        self._stage_tasks(tasks)
        self._assign_positions_for_columns(columns)
        self.db.flush()

    def _stage_tasks(self, tasks: list[KanbanTask]) -> None:
        staging_start = max((task.position for task in tasks), default=-1) + 1
        for index, task in enumerate(tasks):
            task.position = staging_start + index
        self.db.flush()

    @staticmethod
    def _assign_positions(tasks: list[KanbanTask]) -> None:
        for position, task in enumerate(tasks):
            task.position = position

    def _assign_positions_for_columns(self, columns: list[list[KanbanTask]]) -> None:
        for column in columns:
            self._assign_positions(column)
