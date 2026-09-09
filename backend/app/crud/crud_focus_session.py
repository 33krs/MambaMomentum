from datetime import datetime

from sqlalchemy.orm import Session

from app.models.focus_session import FocusSession
from app.schemas.focus_session import FocusSessionCreate, FocusSessionUpdate


class InvalidFocusSessionRange(ValueError):
    pass


def create_focus_session(db: Session, user_id: int, session_in: FocusSessionCreate) -> FocusSession:
    duration = int((session_in.end_time - session_in.start_time).total_seconds() // 60)
    session = FocusSession(
        user_id=user_id,
        category=session_in.category,
        start_time=session_in.start_time,
        end_time=session_in.end_time,
        duration_minutes=duration,
        notes=session_in.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_focus_session(db: Session, session_id: int, user_id: int) -> FocusSession | None:
    return (
        db.query(FocusSession)
        .filter(FocusSession.id == session_id, FocusSession.user_id == user_id)
        .first()
    )


def list_focus_sessions(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[FocusSession]:
    query = db.query(FocusSession).filter(FocusSession.user_id == user_id)
    if start is not None:
        query = query.filter(FocusSession.start_time >= start)
    if end is not None:
        query = query.filter(FocusSession.end_time <= end)
    return query.order_by(FocusSession.start_time.desc()).offset(skip).limit(limit).all()


def update_focus_session(
    db: Session, session: FocusSession, session_in: FocusSessionUpdate
) -> FocusSession:
    data = session_in.model_dump(exclude_unset=True)
    start_time = data.get("start_time", session.start_time)
    end_time = data.get("end_time", session.end_time)
    if end_time <= start_time:
        raise InvalidFocusSessionRange("end_time must be after start_time")
    for field, value in data.items():
        setattr(session, field, value)
    session.duration_minutes = int((end_time - start_time).total_seconds() // 60)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def delete_focus_session(db: Session, session: FocusSession) -> None:
    db.delete(session)
    db.commit()
