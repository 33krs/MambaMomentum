from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.kanban import KANBAN_COLUMNS, KanbanBoard, KanbanColumn, KanbanTask


def get_or_create_board(db: Session, user_id: int) -> KanbanBoard:
    """Return a user's board after ensuring all fixed columns exist exactly once."""
    board = (
        db.query(KanbanBoard)
        .options(selectinload(KanbanBoard.columns))
        .filter(KanbanBoard.user_id == user_id)
        .one_or_none()
    )
    if board is None:
        board = KanbanBoard(user_id=user_id)
        db.add(board)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            board = (
                db.query(KanbanBoard)
                .options(selectinload(KanbanBoard.columns))
                .filter(KanbanBoard.user_id == user_id)
                .one()
            )

    existing_keys = {column.key for column in board.columns}
    for position, (key, name) in enumerate(KANBAN_COLUMNS):
        if key not in existing_keys:
            board.columns.append(KanbanColumn(key=key, name=name, position=position))

    db.commit()
    return (
        db.query(KanbanBoard)
        .options(selectinload(KanbanBoard.columns))
        .filter(KanbanBoard.id == board.id)
        .one()
    )


def get_board(db: Session, user_id: int) -> KanbanBoard | None:
    return (
        db.query(KanbanBoard)
        .options(selectinload(KanbanBoard.columns))
        .filter(KanbanBoard.user_id == user_id)
        .one_or_none()
    )


def get_task(db: Session, task_id: int, user_id: int) -> KanbanTask | None:
    return (
        db.query(KanbanTask)
        .join(KanbanBoard)
        .filter(KanbanTask.id == task_id, KanbanBoard.user_id == user_id)
        .one_or_none()
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
    board = get_board(db, user_id)
    if board is None:
        return None
    column = next((item for item in board.columns if item.id == column_id), None)
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
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: KanbanTask) -> None:
    db.delete(task)
    db.commit()
