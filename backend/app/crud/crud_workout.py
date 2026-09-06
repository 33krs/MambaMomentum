from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.models.workout import Exercise, WorkoutSession, WorkoutSet
from app.schemas.workout import ExerciseCreate, WorkoutSessionCreate, WorkoutSessionUpdate


def list_exercises(db: Session) -> list[Exercise]:
    return db.query(Exercise).order_by(Exercise.name).all()


def get_or_create_exercise(db: Session, exercise_in: ExerciseCreate) -> Exercise:
    exercise = db.query(Exercise).filter(Exercise.name == exercise_in.name).first()
    if exercise:
        return exercise
    exercise = Exercise(name=exercise_in.name, muscle_group=exercise_in.muscle_group)
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


def create_workout_session(
    db: Session, user_id: int, session_in: WorkoutSessionCreate
) -> WorkoutSession:
    workout = WorkoutSession(
        user_id=user_id,
        name=session_in.name,
        date=session_in.date,
        notes=session_in.notes,
    )
    db.add(workout)
    db.flush()

    for set_in in session_in.sets:
        db.add(WorkoutSet(workout_session_id=workout.id, **set_in.model_dump()))

    db.commit()
    db.refresh(workout)
    return workout


def get_workout_session(db: Session, session_id: int, user_id: int) -> WorkoutSession | None:
    return (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets).joinedload(WorkoutSet.exercise))
        .filter(WorkoutSession.id == session_id, WorkoutSession.user_id == user_id)
        .first()
    )


def list_workout_sessions(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    start: date | None = None,
    end: date | None = None,
) -> list[WorkoutSession]:
    query = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets).joinedload(WorkoutSet.exercise))
        .filter(WorkoutSession.user_id == user_id)
    )
    if start is not None:
        query = query.filter(WorkoutSession.date >= start)
    if end is not None:
        query = query.filter(WorkoutSession.date <= end)
    return query.order_by(WorkoutSession.date.desc()).offset(skip).limit(limit).all()


def update_workout_session(
    db: Session, workout: WorkoutSession, session_in: WorkoutSessionUpdate
) -> WorkoutSession:
    data = session_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(workout, field, value)
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


def delete_workout_session(db: Session, workout: WorkoutSession) -> None:
    db.delete(workout)
    db.commit()
