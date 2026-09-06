from datetime import date, datetime, timedelta, timezone

from sqlalchemy import cast, func
from sqlalchemy.orm import Session
from sqlalchemy.types import Date

from app.models.focus_session import FocusSession
from app.models.workout import WorkoutSession, WorkoutSet
from app.schemas.analytics import DashboardSummary, HeatmapPoint, TrendPoint, VolumePoint


def focus_heatmap(db: Session, user_id: int, days: int = 365) -> list[HeatmapPoint]:
    since = date.today() - timedelta(days=days)
    day_col = cast(FocusSession.start_time, Date)
    rows = (
        db.query(day_col.label("day"), func.sum(FocusSession.duration_minutes).label("minutes"))
        .filter(FocusSession.user_id == user_id, day_col >= since)
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )
    minutes_by_day = {row.day: float(row.minutes or 0) for row in rows}

    workout_days = {
        row[0]
        for row in db.query(WorkoutSession.date)
        .filter(WorkoutSession.user_id == user_id, WorkoutSession.date >= since)
        .distinct()
        .all()
    }

    all_days = set(minutes_by_day) | workout_days
    return [
        HeatmapPoint(date=day, value=minutes_by_day.get(day, 0.0), trained=day in workout_days)
        for day in sorted(all_days)
    ]


def focus_trends(db: Session, user_id: int, weeks: int = 12) -> list[TrendPoint]:
    since = date.today() - timedelta(weeks=weeks)
    week_col = cast(func.date_trunc("week", FocusSession.start_time), Date)
    rows = (
        db.query(
            week_col.label("week"),
            func.sum(FocusSession.duration_minutes).label("minutes"),
            func.count(FocusSession.id).label("count"),
        )
        .filter(FocusSession.user_id == user_id, week_col >= since)
        .group_by(week_col)
        .order_by(week_col)
        .all()
    )
    return [
        TrendPoint(
            period_start=row.week,
            total_minutes=int(row.minutes or 0),
            session_count=row.count,
            avg_session_minutes=(row.minutes or 0) / row.count if row.count else 0.0,
        )
        for row in rows
    ]


def workout_volume(db: Session, user_id: int, weeks: int = 12) -> list[VolumePoint]:
    since = date.today() - timedelta(weeks=weeks)
    week_col = cast(func.date_trunc("week", WorkoutSession.date), Date)
    volume_expr = WorkoutSet.reps * WorkoutSet.weight_kg
    rows = (
        db.query(
            week_col.label("week"),
            func.sum(volume_expr).label("volume"),
            func.count(WorkoutSet.id).label("sets"),
        )
        .join(WorkoutSet, WorkoutSet.workout_session_id == WorkoutSession.id)
        .filter(WorkoutSession.user_id == user_id, week_col >= since)
        .group_by(week_col)
        .order_by(week_col)
        .all()
    )
    return [
        VolumePoint(
            period_start=row.week, total_volume_kg=float(row.volume or 0), total_sets=row.sets
        )
        for row in rows
    ]


def dashboard_summary(db: Session, user_id: int) -> DashboardSummary:
    since = datetime.now(timezone.utc) - timedelta(days=7)

    focus_agg = (
        db.query(
            func.coalesce(func.sum(FocusSession.duration_minutes), 0),
            func.count(FocusSession.id),
        )
        .filter(FocusSession.user_id == user_id, FocusSession.start_time >= since)
        .first()
    )
    focus_minutes, focus_count = focus_agg or (0, 0)

    workout_count = (
        db.query(func.count(WorkoutSession.id))
        .filter(WorkoutSession.user_id == user_id, WorkoutSession.date >= since.date())
        .scalar()
        or 0
    )

    volume = (
        db.query(func.coalesce(func.sum(WorkoutSet.reps * WorkoutSet.weight_kg), 0))
        .join(WorkoutSession, WorkoutSession.id == WorkoutSet.workout_session_id)
        .filter(WorkoutSession.user_id == user_id, WorkoutSession.date >= since.date())
        .scalar()
        or 0
    )

    streak = _current_focus_streak(db, user_id)

    return DashboardSummary(
        focus_minutes_last_7_days=int(focus_minutes),
        focus_sessions_last_7_days=int(focus_count),
        workout_sessions_last_7_days=int(workout_count),
        workout_volume_last_7_days_kg=float(volume),
        current_focus_streak_days=streak,
    )


def _current_focus_streak(db: Session, user_id: int) -> int:
    day_col = cast(FocusSession.start_time, Date)
    active_days = {
        row[0] for row in db.query(day_col).filter(FocusSession.user_id == user_id).distinct().all()
    }
    if not active_days:
        return 0

    streak = 0
    cursor = date.today()
    while cursor in active_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
