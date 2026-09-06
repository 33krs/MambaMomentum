from datetime import date

from pydantic import BaseModel


class HeatmapPoint(BaseModel):
    date: date
    value: float


class TrendPoint(BaseModel):
    period_start: date
    total_minutes: int
    session_count: int


class VolumePoint(BaseModel):
    period_start: date
    total_volume_kg: float
    total_sets: int


class DashboardSummary(BaseModel):
    focus_minutes_last_7_days: int
    focus_sessions_last_7_days: int
    workout_sessions_last_7_days: int
    workout_volume_last_7_days_kg: float
    current_focus_streak_days: int
