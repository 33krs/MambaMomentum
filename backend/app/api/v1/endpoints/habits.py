from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.crud.crud_habit import (
    count_logs,
    create_habit,
    delete_habit,
    delete_log,
    get_habit,
    get_log,
    list_habits,
    log_dates_by_habit,
    update_habit,
    upsert_log,
)
from app.models.user import User
from app.schemas.habit import (
    HabitCreate,
    HabitLogCreate,
    HabitLogRead,
    HabitRead,
    HabitStats,
    HabitUpdate,
)

router = APIRouter()


def business_today(user: User) -> date:
    try:
        return datetime.now(ZoneInfo(user.timezone)).date()
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(
            status_code=400, detail="La zona horaria del usuario no es válida"
        ) from exc


def requested_date(user: User, value: date | None) -> date:
    result = value or business_today(user)
    if result > business_today(user):
        raise HTTPException(status_code=422, detail="No se permiten fechas futuras")
    return result


@router.get("/", response_model=list[HabitRead])
def read_habits(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return list_habits(db, current_user.id, include_archived)


@router.post("/", response_model=HabitRead, status_code=status.HTTP_201_CREATED)
def add_habit(
    habit_in: HabitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_habit(db, current_user.id, habit_in)


@router.get("/stats", response_model=HabitStats)
def read_stats(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    today = business_today(current_user)
    period_end = end or today
    period_start = start or (period_end - timedelta(days=period_end.weekday()))
    if period_start > period_end or period_end > today:
        raise HTTPException(status_code=422, detail="El intervalo de fechas no es válido")
    active = len(list_habits(db, current_user.id))
    elapsed_days = (period_end - period_start).days + 1
    completed = count_logs(db, current_user.id, period_start, period_end)
    denominator = active * elapsed_days
    streak = 0
    by_habit: dict[int, set[date]] = {}
    for habit_id, log_date in log_dates_by_habit(db, current_user.id, period_start, period_end):
        by_habit.setdefault(habit_id, set()).add(log_date)
    for dates in by_habit.values():
        cursor = period_end
        current = 0
        while cursor in dates:
            current += 1
            cursor -= timedelta(days=1)
        streak = max(streak, current)
    return HabitStats(
        start=period_start,
        end=period_end,
        active_habits=active,
        elapsed_days=elapsed_days,
        completed=completed,
        percentage=(completed / denominator * 100) if denominator else 0,
        current_streak_days=streak,
    )


@router.get("/{habit_id}", response_model=HabitRead)
def read_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    habit = get_habit(db, habit_id, current_user.id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")
    return habit


@router.patch("/{habit_id}", response_model=HabitRead)
def edit_habit(
    habit_id: int,
    habit_in: HabitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    habit = get_habit(db, habit_id, current_user.id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")
    return update_habit(db, habit, habit_in)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    habit = get_habit(db, habit_id, current_user.id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")
    delete_habit(db, habit)


@router.post("/{habit_id}/logs", response_model=HabitLogRead)
def mark_habit(
    habit_id: int,
    log_in: HabitLogCreate | None = None,
    log_date: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    habit = get_habit(db, habit_id, current_user.id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")
    requested = log_date if log_date is not None else (log_in.date if log_in else None)
    return upsert_log(db, habit.id, requested_date(current_user, requested))


@router.delete("/{habit_id}/logs", status_code=status.HTTP_204_NO_CONTENT)
def unmark_habit(
    habit_id: int,
    log_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    habit = get_habit(db, habit_id, current_user.id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")
    log_date = requested_date(current_user, log_date)
    log = get_log(db, habit.id, log_date)
    if log is not None:
        delete_log(db, log)
