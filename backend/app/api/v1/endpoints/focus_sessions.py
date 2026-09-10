from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.crud.crud_focus_session import (
    InvalidFocusSessionRange,
    create_focus_session,
    delete_focus_session,
    get_focus_session,
    list_focus_sessions,
    update_focus_session,
)
from app.models.user import User
from app.schemas.focus_session import FocusSessionCreate, FocusSessionRead, FocusSessionUpdate

router = APIRouter()


@router.post("/", response_model=FocusSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: FocusSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_focus_session(db, current_user.id, session_in)


@router.get("/", response_model=list[FocusSessionRead])
def read_sessions(
    skip: int = 0,
    limit: int = 100,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return list_focus_sessions(db, current_user.id, skip, limit, start, end)


@router.get("/{session_id}", response_model=FocusSessionRead)
def read_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = get_focus_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")
    return session


@router.put("/{session_id}", response_model=FocusSessionRead)
def update_session(
    session_id: int,
    session_in: FocusSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = get_focus_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")
    try:
        return update_focus_session(db, session, session_in)
    except InvalidFocusSessionRange as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="end_time debe ser posterior a start_time",
        ) from exc


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = get_focus_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")
    delete_focus_session(db, session)
