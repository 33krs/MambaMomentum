from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.crud.crud_workout import (
    create_workout_session,
    delete_workout_session,
    get_or_create_exercise,
    get_workout_session,
    list_exercises,
    list_workout_sessions,
    update_workout_session,
)
from app.models.user import User
from app.schemas.workout import (
    ExerciseCreate,
    ExerciseRead,
    WorkoutSessionCreate,
    WorkoutSessionRead,
    WorkoutSessionUpdate,
)

router = APIRouter()


@router.get("/exercises", response_model=list[ExerciseRead])
def read_exercises(db: Session = Depends(get_db)):
    return list_exercises(db)


@router.post("/exercises", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
def create_exercise(
    exercise_in: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_or_create_exercise(db, exercise_in)


@router.post("/", response_model=WorkoutSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: WorkoutSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_workout_session(db, current_user.id, session_in)


@router.get("/", response_model=list[WorkoutSessionRead])
def read_sessions(
    skip: int = 0,
    limit: int = 100,
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return list_workout_sessions(db, current_user.id, skip, limit, start, end)


@router.get("/{session_id}", response_model=WorkoutSessionRead)
def read_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = get_workout_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entrenamiento no encontrado"
        )
    return session


@router.put("/{session_id}", response_model=WorkoutSessionRead)
def update_session(
    session_id: int,
    session_in: WorkoutSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = get_workout_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entrenamiento no encontrado"
        )
    return update_workout_session(db, session, session_in)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = get_workout_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entrenamiento no encontrado"
        )
    delete_workout_session(db, session)
