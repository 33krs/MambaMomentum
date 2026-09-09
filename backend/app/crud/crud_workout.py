from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
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
    WorkoutTemplateUpdate,
)


class ExerciseNotFound(ValueError):
    pass


class ExerciseNameTaken(ValueError):
    pass


EXERCISE_NAME_CONSTRAINTS = {
    "uq_exercises_system_name_ci",
    "uq_exercises_owner_name_ci",
}


def _is_exercise_name_conflict(exc: IntegrityError) -> bool:
    diagnostic = getattr(exc.orig, "diag", None)
    return getattr(diagnostic, "constraint_name", None) in EXERCISE_NAME_CONSTRAINTS


def _catalog_exercise_filter(user_id: int):
    return or_(
        (Exercise.owner_id.is_(None) & Exercise.catalog_visible.is_(True)),
        Exercise.owner_id == user_id,
    )


def _accessible_exercise_filter(user_id: int):
    return or_(Exercise.owner_id.is_(None), Exercise.owner_id == user_id)


def list_exercises(db: Session, user_id: int) -> list[Exercise]:
    return (
        db.query(Exercise).filter(_catalog_exercise_filter(user_id)).order_by(Exercise.name).all()
    )


def get_exercise(db: Session, exercise_id: int, user_id: int) -> Exercise | None:
    return (
        db.query(Exercise)
        .filter(Exercise.id == exercise_id, _accessible_exercise_filter(user_id))
        .first()
    )


def get_owned_exercise(db: Session, exercise_id: int, user_id: int) -> Exercise | None:
    return (
        db.query(Exercise).filter(Exercise.id == exercise_id, Exercise.owner_id == user_id).first()
    )


def get_or_create_exercise(db: Session, user_id: int, exercise_in: ExerciseCreate) -> Exercise:
    normalized_name = exercise_in.name.strip()
    own_exercise = (
        db.query(Exercise)
        .filter(
            Exercise.owner_id == user_id,
            func.lower(Exercise.name) == normalized_name.lower(),
        )
        .first()
    )
    if own_exercise:
        return own_exercise
    system_exercise = (
        db.query(Exercise)
        .filter(
            Exercise.owner_id.is_(None),
            func.lower(Exercise.name) == normalized_name.lower(),
        )
        .first()
    )
    if system_exercise:
        raise ExerciseNameTaken("exercise_name_taken")
    exercise = Exercise(
        name=normalized_name,
        muscle_group=exercise_in.muscle_group,
        owner_id=user_id,
    )
    db.add(exercise)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if not _is_exercise_name_conflict(exc):
            raise
        existing = (
            db.query(Exercise)
            .filter(
                Exercise.owner_id == user_id,
                func.lower(Exercise.name) == normalized_name.lower(),
            )
            .first()
        )
        if existing is not None:
            return existing
        raise ExerciseNameTaken("exercise_name_taken") from exc
    db.refresh(exercise)
    return exercise


def update_exercise(
    db: Session, exercise_id: int, user_id: int, exercise_in: ExerciseUpdate
) -> Exercise:
    exercise = get_owned_exercise(db, exercise_id, user_id)
    if exercise is None:
        raise ExerciseNotFound("exercise_not_found")
    data = exercise_in.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != exercise.name:
        data["name"] = data["name"].strip()
        existing = (
            db.query(Exercise)
            .filter(
                _accessible_exercise_filter(user_id),
                func.lower(Exercise.name) == data["name"].lower(),
                Exercise.id != exercise.id,
            )
            .first()
        )
        if existing:
            raise ExerciseNameTaken("exercise_name_taken")
    for field, value in data.items():
        setattr(exercise, field, value)
    if "name" in data:
        db.query(WorkoutTemplateExercise).filter(
            WorkoutTemplateExercise.exercise_id == exercise.id
        ).update(
            {WorkoutTemplateExercise.exercise_name: exercise.name},
            synchronize_session=False,
        )
    db.add(exercise)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_exercise_name_conflict(exc):
            raise ExerciseNameTaken("exercise_name_taken") from exc
        raise
    db.refresh(exercise)
    return exercise


def delete_exercise(db: Session, exercise_id: int, user_id: int) -> None:
    exercise = get_owned_exercise(db, exercise_id, user_id)
    if exercise is None:
        raise ExerciseNotFound("exercise_not_found")
    db.delete(exercise)
    db.commit()


def create_workout_session(
    db: Session, user_id: int, session_in: WorkoutSessionCreate
) -> WorkoutSession:
    exercises = {
        set_in.exercise_id: get_exercise(db, set_in.exercise_id, user_id)
        for set_in in session_in.sets
    }
    if any(exercise is None for exercise in exercises.values()):
        raise ExerciseNotFound("exercise_not_found")
    workout = WorkoutSession(
        user_id=user_id,
        name=session_in.name,
        date=session_in.date,
        notes=session_in.notes,
    )
    db.add(workout)
    db.flush()

    for set_in in session_in.sets:
        exercise = exercises[set_in.exercise_id]
        if exercise is None:
            raise ExerciseNotFound("exercise_not_found")
        db.add(
            WorkoutSet(
                workout_session_id=workout.id,
                exercise_name=exercise.name,
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
    exercises = {}
    if sets_data is not None:
        exercises = {
            set_in["exercise_id"]: get_exercise(db, set_in["exercise_id"], workout.user_id)
            for set_in in sets_data
        }
        if any(exercise is None for exercise in exercises.values()):
            raise ExerciseNotFound("exercise_not_found")
    for field, value in data.items():
        setattr(workout, field, value)

    if sets_data is not None:
        workout.sets.clear()
        db.flush()
        for set_in in sets_data:
            exercise = exercises[set_in["exercise_id"]]
            if exercise is None:
                raise ExerciseNotFound("exercise_not_found")
            db.add(
                WorkoutSet(
                    workout_session_id=workout.id,
                    exercise_name=exercise.name,
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
    exercises = {
        item_in.exercise_id: get_exercise(db, item_in.exercise_id, user_id)
        for item_in in template_in.items
    }
    if any(exercise is None for exercise in exercises.values()):
        raise ExerciseNotFound("exercise_not_found")
    template = WorkoutTemplate(user_id=user_id, name=template_in.name)
    db.add(template)
    db.flush()

    for item_in in template_in.items:
        exercise = exercises[item_in.exercise_id]
        if exercise is None:
            raise ExerciseNotFound("exercise_not_found")
        db.add(
            WorkoutTemplateExercise(
                template_id=template.id,
                exercise_name=exercise.name,
                **item_in.model_dump(),
            )
        )

    db.commit()
    db.refresh(template)
    return template


def update_workout_template(
    db: Session,
    template: WorkoutTemplate,
    user_id: int,
    template_in: WorkoutTemplateUpdate,
) -> WorkoutTemplate:
    exercises = {
        item_in.exercise_id: get_exercise(db, item_in.exercise_id, user_id)
        for item_in in template_in.items
    }
    if any(exercise is None for exercise in exercises.values()):
        raise ExerciseNotFound("exercise_not_found")

    template.name = template_in.name
    template.items.clear()
    db.flush()
    for item_in in template_in.items:
        exercise = exercises[item_in.exercise_id]
        if exercise is None:
            raise ExerciseNotFound("exercise_not_found")
        template.items.append(
            WorkoutTemplateExercise(
                exercise_id=exercise.id,
                exercise_name=exercise.name,
                sets_count=item_in.sets_count,
                order_index=item_in.order_index,
            )
        )
    db.commit()
    return get_workout_template(db, template.id, user_id)  # type: ignore[return-value]


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
                    exercise_name=(
                        item.exercise.name if item.exercise is not None else item.exercise_name
                    ),
                    set_number=set_number,
                    reps=0,
                    weight_kg=0,
                )
            )

    db.commit()
    db.refresh(workout)
    return workout
