from datetime import date

import pytest
from sqlalchemy import delete
from sqlalchemy.exc import DataError, IntegrityError

from app.models.habit import Habit, HabitLog
from app.models.user import User


def create_user(db, email: str) -> User:
    user = User(email=email, hashed_password="not-used")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_habit_is_owned_by_a_user_and_logs_store_business_dates(db):
    user = create_user(db, "habits@example.com")
    habit = Habit(user_id=user.id, name="Read", color="#2563EB")
    log = HabitLog(habit=habit, date=date(2026, 9, 1))

    db.add(log)
    db.commit()
    db.refresh(habit)

    assert habit.status == "active"
    assert habit.owner.id == user.id
    assert habit.logs[0].date == date(2026, 9, 1)


@pytest.mark.parametrize(
    ("habit", "error_type"),
    [
        (Habit(name="", color="#2563EB"), IntegrityError),
        (Habit(name="A" * 121, color="#2563EB"), DataError),
        (Habit(name="Read", color="blue"), IntegrityError),
        (Habit(name="Read", status="paused"), IntegrityError),
    ],
)
def test_habit_constraints_validate_name_color_and_status(db, habit, error_type):
    user = create_user(db, "habit-constraints@example.com")

    habit.user_id = user.id
    db.add(habit)
    with pytest.raises(error_type):
        db.commit()
    db.rollback()


def test_habit_log_is_unique_per_habit_and_business_date(db):
    user = create_user(db, "habit-logs@example.com")
    habit = Habit(user_id=user.id, name="Walk")
    db.add(habit)
    db.commit()

    db.add_all(
        [
            HabitLog(habit_id=habit.id, date=date(2026, 9, 1)),
            HabitLog(habit_id=habit.id, date=date(2026, 9, 1)),
        ]
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_deleting_a_user_cascades_to_habits_and_logs(db):
    user = create_user(db, "cascade@example.com")
    habit = Habit(user_id=user.id, name="Meditate")
    db.add(habit)
    db.commit()
    db.add(HabitLog(habit_id=habit.id, date=date(2026, 9, 1)))
    db.commit()

    db.execute(delete(User).where(User.id == user.id))
    db.commit()

    assert db.query(Habit).count() == 0
    assert db.query(HabitLog).count() == 0
