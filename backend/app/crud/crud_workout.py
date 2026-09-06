from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.models.workout import (
    Exercise,
    WorkoutSession,
    WorkoutSet,
    WorkoutTemplate,
    WorkoutTemplateExercise,
)
from app.schemas.workout import (
    ExerciseCreate,
    ExerciseUpdate,
    WorkoutSessionCreate,
    WorkoutSessionUpdate,
    WorkoutTemplateCreate,
)


def list_exercises(db: Session) -> list[Exercise]:
    return db.query(Exercise).order_by(Exercise.name).all()


def get_exercise(db: Session, exercise_id: int) -> Exercise | None:
    return db.query(Exercise).filter(Exercise.id == exercise_id).first()


def get_or_create_exercise(db: Session, exercise_in: ExerciseCreate) -> Exercise:
    exercise = db.query(Exercise).filter(Exercise.name == exercise_in.name).first()
    if exercise:
        return exercise
    exercise = Exercise(name=exercise_in.name, muscle_group=exercise_in.muscle_group)
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


def update_exercise(db: Session, exercise: Exercise, exercise_in: ExerciseUpdate) -> Exercise:
    data = exercise_in.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != exercise.name:
        existing = db.query(Exercise).filter(Exercise.name == data["name"]).first()
        if existing:
            raise ValueError("exercise_name_taken")
    for field, value in data.items():
        setattr(exercise, field, value)
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


def delete_exercise(db: Session, exercise: Exercise) -> None:
    db.delete(exercise)
    db.commit()


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
        exercise = get_exercise(db, set_in.exercise_id)
        db.add(
            WorkoutSet(
                workout_session_id=workout.id,
                exercise_name=exercise.name if exercise else "",
                **set_in.model_dump(),
            )
        )

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
    sets_data = data.pop("sets", None)
    for field, value in data.items():
        setattr(workout, field, value)

    if sets_data is not None:
        workout.sets.clear()
        db.flush()
        for set_in in sets_data:
            exercise = get_exercise(db, set_in["exercise_id"])
            db.add(
                WorkoutSet(
                    workout_session_id=workout.id,
                    exercise_name=exercise.name if exercise else "",
                    **set_in,
                )
            )

    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


def delete_workout_session(db: Session, workout: WorkoutSession) -> None:
    db.delete(workout)
    db.commit()


def create_workout_template(
    db: Session, user_id: int, template_in: WorkoutTemplateCreate
) -> WorkoutTemplate:
    template = WorkoutTemplate(user_id=user_id, name=template_in.name)
    db.add(template)
    db.flush()

    for item_in in template_in.items:
        db.add(WorkoutTemplateExercise(template_id=template.id, **item_in.model_dump()))

    db.commit()
    db.refresh(template)
    return template


def list_workout_templates(db: Session, user_id: int) -> list[WorkoutTemplate]:
    return (
        db.query(WorkoutTemplate)
        .options(joinedload(WorkoutTemplate.items).joinedload(WorkoutTemplateExercise.exercise))
        .filter(WorkoutTemplate.user_id == user_id)
        .order_by(WorkoutTemplate.name)
        .all()
    )


def get_workout_template(db: Session, template_id: int, user_id: int) -> WorkoutTemplate | None:
    return (
        db.query(WorkoutTemplate)
        .options(joinedload(WorkoutTemplate.items).joinedload(WorkoutTemplateExercise.exercise))
        .filter(WorkoutTemplate.id == template_id, WorkoutTemplate.user_id == user_id)
        .first()
    )


def delete_workout_template(db: Session, template: WorkoutTemplate) -> None:
    db.delete(template)
    db.commit()


def apply_workout_template(
    db: Session, template: WorkoutTemplate, apply_date: date
) -> WorkoutSession:
    workout = WorkoutSession(user_id=template.user_id, name=template.name, date=apply_date)
    db.add(workout)
    db.flush()

    for item in template.items:
        for set_number in range(1, item.sets_count + 1):
            db.add(
                WorkoutSet(
                    workout_session_id=workout.id,
                    exercise_id=item.exercise_id,
                    exercise_name=item.exercise.name,
                    set_number=set_number,
                    reps=0,
                    weight_kg=0,
                )
            )

    db.commit()
    db.refresh(workout)
    return workout
