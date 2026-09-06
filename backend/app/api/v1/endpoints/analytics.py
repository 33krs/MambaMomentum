from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.crud.crud_analytics import (
    dashboard_summary,
    focus_heatmap,
    focus_trends,
    workout_volume,
)
from app.models.user import User
from app.schemas.analytics import DashboardSummary, HeatmapPoint, TrendPoint, VolumePoint

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def read_summary(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    return dashboard_summary(db, current_user.id)


@router.get("/focus/heatmap", response_model=list[HeatmapPoint])
def read_focus_heatmap(
    days: int = 365,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return focus_heatmap(db, current_user.id, days)


@router.get("/focus/trends", response_model=list[TrendPoint])
def read_focus_trends(
    weeks: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return focus_trends(db, current_user.id, weeks)


@router.get("/workouts/volume", response_model=list[VolumePoint])
def read_workout_volume(
    weeks: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return workout_volume(db, current_user.id, weeks)
