from datetime import datetime
from zoneinfo import ZoneInfo

from app.models.user import User


def register_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret123"},
    )
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "supersecret123"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_habit_crud_and_owner_isolation(client, auth_headers):
    created = client.post(
        "/api/v1/habits/",
        json={"name": "Read", "color": "#2563EB"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    habit = created.json()
    assert habit["status"] == "active"

    other_headers = register_and_login(client, "habits-api-other@example.com")
    assert client.get(f"/api/v1/habits/{habit['id']}", headers=other_headers).status_code == 404

    updated = client.patch(
        f"/api/v1/habits/{habit['id']}",
        json={"name": "Read daily"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Read daily"


def test_habit_logs_are_retroactive_idempotent_and_default_to_business_today(
    client, auth_headers, db
):
    habit = client.post("/api/v1/habits/", json={"name": "Walk"}, headers=auth_headers).json()
    retroactive = client.post(
        f"/api/v1/habits/{habit['id']}/logs",
        json={"date": "2026-09-01"},
        headers=auth_headers,
    )
    repeated = client.post(
        f"/api/v1/habits/{habit['id']}/logs",
        json={"date": "2026-09-01"},
        headers=auth_headers,
    )
    user = db.query(User).filter(User.email == "athlete@example.com").one()
    user.timezone = "America/Santiago"
    db.commit()
    today = client.post(f"/api/v1/habits/{habit['id']}/logs", headers=auth_headers)

    assert retroactive.status_code == 200
    assert repeated.json()["id"] == retroactive.json()["id"]
    assert today.json()["date"] == datetime.now(ZoneInfo("America/Santiago")).date().isoformat()


def test_habit_logs_reject_future_dates_and_can_be_removed(client, auth_headers):
    habit = client.post("/api/v1/habits/", json={"name": "Future"}, headers=auth_headers).json()
    future = client.post(
        f"/api/v1/habits/{habit['id']}/logs",
        json={"date": "2999-01-01"},
        headers=auth_headers,
    )
    assert future.status_code == 422

    client.post(
        f"/api/v1/habits/{habit['id']}/logs",
        json={"date": "2026-09-01"},
        headers=auth_headers,
    )
    removed = client.delete(
        f"/api/v1/habits/{habit['id']}/logs?date=2026-09-01",
        headers=auth_headers,
    )
    assert removed.status_code == 204


def test_habit_stats_use_monday_sunday_period_and_active_habits(client, auth_headers):
    habit = client.post("/api/v1/habits/", json={"name": "Stats"}, headers=auth_headers).json()
    client.post(
        f"/api/v1/habits/{habit['id']}/logs",
        json={"date": "2026-09-14"},
        headers=auth_headers,
    )
    response = client.get(
        "/api/v1/habits/stats?start=2026-09-14&end=2026-09-18",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["elapsed_days"] == 5
    assert response.json()["completed"] == 1
    assert response.json()["percentage"] == 20
