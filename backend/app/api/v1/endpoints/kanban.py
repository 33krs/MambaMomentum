from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.kanban import (
    KanbanBoardRead,
    KanbanTaskCreate,
    KanbanTaskMove,
    KanbanTaskRead,
    KanbanTaskUpdate,
)
from app.services.kanban import KanbanInvalidPositionError, KanbanNotFoundError, KanbanService

router = APIRouter()


@router.get("/", response_model=KanbanBoardRead)
def read_board(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _run_mutation(lambda: _service(db).read_board(current_user.id))


@router.get("/tasks/{task_id}", response_model=KanbanTaskRead)
def read_board_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _run_mutation(lambda: _service(db).read_task(current_user.id, task_id))


@router.post("/tasks", response_model=KanbanBoardRead, status_code=status.HTTP_201_CREATED)
def create_board_task(
    task_in: KanbanTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _run_mutation(lambda: _service(db).create_task(current_user.id, task_in))


@router.patch("/tasks/{task_id}", response_model=KanbanBoardRead)
def update_board_task(
    task_id: int,
    task_in: KanbanTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _run_mutation(lambda: _service(db).update_task(current_user.id, task_id, task_in))


@router.patch("/tasks/{task_id}/move", response_model=KanbanBoardRead)
def move_board_task(
    task_id: int,
    move_in: KanbanTaskMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _run_mutation(lambda: _service(db).move_task(current_user.id, task_id, move_in))


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _run_mutation(lambda: _service(db).delete_task(current_user.id, task_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _service(db: Session) -> KanbanService:
    return KanbanService(db)


def _run_mutation(operation):
    try:
        return operation()
    except KanbanNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kanban resource not found"
        ) from exc
    except KanbanInvalidPositionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="position is outside the destination column",
        ) from exc
