from fastapi import APIRouter

from app.api.v1.endpoints import analytics, auth, focus_sessions, kanban, workouts

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(focus_sessions.router, prefix="/focus-sessions", tags=["focus-sessions"])
api_router.include_router(workouts.router, prefix="/workouts", tags=["workouts"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(kanban.router, prefix="/kanban", tags=["kanban"])
