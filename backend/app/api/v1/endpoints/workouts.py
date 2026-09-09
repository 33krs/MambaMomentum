from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.crud.crud_workout import (
    ExerciseNameTaken,
    ExerciseNotFound,
    apply_workout_template,
    create_workout_session,
    create_workout_template,
    delete_exercise,
    delete_workout_session,
    delete_workout_template,
    get_or_create_exercise,
    get_workout_session,
    get_workout_template,
    list_exercises,
    list_workout_sessions,
    list_workout_templates,
    update_exercise,
    update_workout_template,
    update_workout_session,
)
from app.models.user import User
from app.schemas.workout import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseUpdate,
    WorkoutSessionCreate,
    WorkoutSessionRead,
    WorkoutSessionUpdate,
    WorkoutTemplateApply,
    WorkoutTemplateCreate,
    WorkoutTemplateRead,
    WorkoutTemplateUpdate,
)

router = APIRouter()


@router.get("/exercises", response_model=list[ExerciseRead])
def read_exercises(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return list_exercises(db, current_user.id)


@router.post("/exercises", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
def create_exercise(
    exercise_in: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return get_or_create_exercise(db, current_user.id, exercise_in)
    except ExerciseNameTaken as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un ejercicio visible con ese nombre",
        ) from exc


@router.put("/exercises/{exercise_id}", response_model=ExerciseRead)
def rename_exercise(
    exercise_id: int,
    exercise_in: ExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return update_exercise(db, exercise_id, current_user.id, exercise_in)
    except ExerciseNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado"
        ) from exc
    except ExerciseNameTaken as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya existe un ejercicio con ese nombre"
        ) from exc


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        delete_exercise(db, exercise_id, current_user.id)
    except ExerciseNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado"
        ) from exc


@router.post("/templates", response_model=WorkoutTemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    template_in: WorkoutTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return create_workout_template(db, current_user.id, template_in)
    except ExerciseNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado"
        ) from exc


@router.put("/templates/{template_id}", response_model=WorkoutTemplateRead)
def update_template(
    template_id: int,
    template_in: WorkoutTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    template = get_workout_template(db, template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plantilla no encontrada")
    try:
        return update_workout_template(db, template, current_user.id, template_in)
    except ExerciseNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado"
        ) from exc


@router.get("/templates", response_model=list[WorkoutTemplateRead])
def read_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return list_workout_templates(db, current_user.id)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    template = get_workout_template(db, template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plantilla no encontrada")
    delete_workout_template(db, template)


@router.post(
    "/templates/{template_id}/apply",
    response_model=WorkoutSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def apply_template(
    template_id: int,
    apply_in: WorkoutTemplateApply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    template = get_workout_template(db, template_id, current_user.id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plantilla no encontrada")
    return apply_workout_template(db, template, apply_in.date)


@router.post("/", response_model=WorkoutSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: WorkoutSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return create_workout_session(db, current_user.id, session_in)
    except ExerciseNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado"
        ) from exc


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
    try:
        return update_workout_session(db, session, session_in)
    except ExerciseNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ejercicio no encontrado"
        ) from exc


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
