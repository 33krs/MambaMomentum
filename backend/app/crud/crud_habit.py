from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.habit import Habit, HabitLog
from app.schemas.habit import HabitCreate, HabitUpdate


def list_habits(db: Session, user_id: int, include_archived: bool = False) -> list[Habit]:
    query = db.query(Habit).options(selectinload(Habit.logs)).filter(Habit.user_id == user_id)
    if not include_archived:
        query = query.filter(Habit.status == "active")
    return query.order_by(Habit.id).all()


def get_habit(db: Session, habit_id: int, user_id: int) -> Habit | None:
    return (
        db.query(Habit)
        .options(selectinload(Habit.logs))
        .filter(Habit.id == habit_id, Habit.user_id == user_id)
        .first()
    )


def create_habit(db: Session, user_id: int, habit_in: HabitCreate) -> Habit:
    habit = Habit(user_id=user_id, **habit_in.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def update_habit(db: Session, habit: Habit, habit_in: HabitUpdate) -> Habit:
    for field, value in habit_in.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def delete_habit(db: Session, habit: Habit) -> None:
    db.delete(habit)
    db.commit()


def get_log(db: Session, habit_id: int, log_date: date) -> HabitLog | None:
    return (
        db.query(HabitLog).filter(HabitLog.habit_id == habit_id, HabitLog.date == log_date).first()
    )


def upsert_log(db: Session, habit_id: int, log_date: date) -> HabitLog:
    log = get_log(db, habit_id, log_date)
    if log is None:
        log = HabitLog(habit_id=habit_id, date=log_date)
        db.add(log)
        db.commit()
        db.refresh(log)
    return log


def delete_log(db: Session, log: HabitLog) -> None:
    db.delete(log)
    db.commit()


def count_logs(db: Session, user_id: int, start: date, end: date) -> int:
    return (
        db.query(func.count(HabitLog.id))
        .join(Habit, Habit.id == HabitLog.habit_id)
        .filter(
            Habit.user_id == user_id,
            Habit.status == "active",
            HabitLog.date.between(start, end),
        )
        .scalar()
        or 0
    )


def log_dates_by_habit(db: Session, user_id: int, start: date, end: date) -> list[tuple[int, date]]:
    return (
        db.query(HabitLog.habit_id, HabitLog.date)
        .join(Habit, Habit.id == HabitLog.habit_id)
        .filter(
            Habit.user_id == user_id,
            Habit.status == "active",
            HabitLog.date.between(start, end),
        )
        .order_by(HabitLog.habit_id, HabitLog.date.desc())
        .all()
    )
