from sqlalchemy.orm import Session, selectinload

from app.models.kanban import KANBAN_COLUMNS, KanbanBoard, KanbanColumn, KanbanTask


def _board_load_options():
    return (
        selectinload(KanbanBoard.columns).selectinload(KanbanColumn.tasks),
        selectinload(KanbanBoard.tasks),
    )


def get_or_create_board(db: Session, user_id: int) -> KanbanBoard:
    """Return a board with its fixed columns, flushing but never committing."""
    board = get_board(db, user_id)
    if board is None:
        board = KanbanBoard(user_id=user_id)
        db.add(board)
        db.flush()

    existing_keys = {column.key for column in board.columns}
    for position, (key, name) in enumerate(KANBAN_COLUMNS):
        if key not in existing_keys:
            db.add(KanbanColumn(board_id=board.id, key=key, name=name, position=position))
    db.flush()
    db.expire(board, ["columns", "tasks"])
    return get_board_by_id(db, board.id)


def get_board(db: Session, user_id: int) -> KanbanBoard | None:
    """Load one owner's complete board with deterministic relationship ordering."""
    return (
        db.query(KanbanBoard)
        .options(*_board_load_options())
        .filter(KanbanBoard.user_id == user_id)
        .one_or_none()
    )


def get_board_by_id(db: Session, board_id: int) -> KanbanBoard:
    return (
        db.query(KanbanBoard)
        .options(*_board_load_options())
        .filter(KanbanBoard.id == board_id)
        .one()
    )


def get_locked_board(db: Session, user_id: int) -> KanbanBoard | None:
    """Lock the owner's board before an ordering mutation is resolved."""
    return (
        db.query(KanbanBoard)
        .options(*_board_load_options())
        .filter(KanbanBoard.user_id == user_id)
        .with_for_update()
        .one_or_none()
    )


def get_column(db: Session, board_id: int, column_id: int) -> KanbanColumn | None:
    return (
        db.query(KanbanColumn)
        .filter(KanbanColumn.board_id == board_id, KanbanColumn.id == column_id)
        .one_or_none()
    )


def get_task(db: Session, task_id: int, user_id: int) -> KanbanTask | None:
    """Resolve a task in the owner's scope, so callers can return a uniform 404."""
    return (
        db.query(KanbanTask)
        .join(KanbanBoard)
        .filter(KanbanTask.id == task_id, KanbanBoard.user_id == user_id)
        .one_or_none()
    )


def list_column_tasks(db: Session, board_id: int, column_id: int) -> list[KanbanTask]:
    return (
        db.query(KanbanTask)
        .filter(KanbanTask.board_id == board_id, KanbanTask.column_id == column_id)
        .order_by(KanbanTask.position, KanbanTask.id)
        .all()
    )


def create_task(
    db: Session,
    user_id: int,
    column_id: int,
    title: str,
    background_color: str,
    position: int,
    description: str | None = None,
) -> KanbanTask | None:
    """Create a task in an owned column and flush for service-level composition."""
    board = get_board(db, user_id)
    if board is None:
        return None
    column = get_column(db, board.id, column_id)
    if column is None:
        return None
    task = KanbanTask(
        board_id=board.id,
        column_id=column.id,
        title=title,
        description=description,
        background_color=background_color,
        position=position,
    )
    db.add(task)
    db.flush()
    return task


def update_task(db: Session, task: KanbanTask, **values: object) -> KanbanTask:
    """Apply a content or ordering change without taking ownership of the transaction."""
    for field, value in values.items():
        setattr(task, field, value)
    db.flush()
    return task


def delete_task(db: Session, task: KanbanTask) -> None:
    """Delete and flush; the Kanban service owns the eventual commit or rollback."""
    db.delete(task)
    db.flush()
