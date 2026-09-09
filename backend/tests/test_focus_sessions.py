from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.focus_session import FocusSession
from app.models.user import User


def test_create_focus_session(client, auth_headers):
    response = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Estudio",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T10:30:00Z",
            "notes": "Repaso de FastAPI",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["duration_minutes"] == 90
    assert data["category"] == "Estudio"


def test_create_focus_session_invalid_range(client, auth_headers):
    response = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Estudio",
            "start_time": "2026-09-01T10:00:00Z",
            "end_time": "2026-09-01T09:00:00Z",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "start_time,end_time",
    [
        ("2026-09-01T09:00:00", "2026-09-01T10:00:00Z"),
        ("2026-09-01T09:00:00Z", "2026-09-01T10:00:00"),
        ("2026-09-01T09:00:00", "2026-09-01T10:00:00"),
    ],
    ids=["naive-start", "naive-end", "both-naive"],
)
def test_create_focus_session_rejects_naive_timestamps(client, auth_headers, start_time, end_time):
    response = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": start_time,
            "end_time": end_time,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_create_focus_session_accepts_aware_timestamps_with_different_offsets(client, auth_headers):
    response = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T12:00:00+01:00",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["duration_minutes"] == 120


def test_list_focus_sessions(client, auth_headers):
    for hour in range(2):
        client.post(
            "/api/v1/focus-sessions/",
            json={
                "category": "Trabajo",
                "start_time": f"2026-09-0{hour + 1}T09:00:00Z",
                "end_time": f"2026-09-0{hour + 1}T10:00:00Z",
            },
            headers=auth_headers,
        )
    response = client.get("/api/v1/focus-sessions/", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_and_delete_focus_session(client, auth_headers):
    create_resp = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T10:00:00Z",
        },
        headers=auth_headers,
    )
    session_id = create_resp.json()["id"]

    update_resp = client.put(
        f"/api/v1/focus-sessions/{session_id}",
        json={"category": "Proyecto Personal"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["category"] == "Proyecto Personal"

    delete_resp = client.delete(f"/api/v1/focus-sessions/{session_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/v1/focus-sessions/{session_id}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.parametrize(
    "patch",
    [
        {"start_time": "2026-09-01T10:00:00Z"},
        {"end_time": "2026-09-01T09:00:00Z"},
    ],
    ids=["start-only", "end-only"],
)
def test_partial_update_rejects_invalid_focus_session_range(client, auth_headers, patch):
    created = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T10:00:00Z",
        },
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/focus-sessions/{created['id']}",
        json=patch,
        headers=auth_headers,
    )
    persisted = client.get(f"/api/v1/focus-sessions/{created['id']}", headers=auth_headers).json()

    assert response.status_code == 422
    assert persisted["start_time"] == created["start_time"]
    assert persisted["end_time"] == created["end_time"]
    assert persisted["duration_minutes"] == 60


def test_database_rejects_invalid_focus_session_range(db, auth_headers):
    user = db.query(User).filter(User.email == "athlete@example.com").one()
    session = FocusSession(
        user_id=user.id,
        category="Invalid",
        start_time=datetime(2026, 9, 1, 10, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 1, 9, tzinfo=timezone.utc),
        duration_minutes=-60,
    )
    db.add(session)

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_partial_update_rejects_null_focus_session_time(client, auth_headers):
    created = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T10:00:00Z",
        },
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/focus-sessions/{created['id']}",
        json={"end_time": None},
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "patch",
    [
        {"start_time": "2026-09-01T08:00:00"},
        {"end_time": "2026-09-01T11:00:00"},
    ],
    ids=["naive-start-only", "naive-end-only"],
)
def test_partial_update_rejects_naive_focus_session_time(client, auth_headers, patch):
    created = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T10:00:00Z",
        },
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/focus-sessions/{created['id']}",
        json=patch,
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "patch,expected_duration",
    [
        ({"start_time": "2026-09-01T11:00:00+03:00"}, 120),
        ({"end_time": "2026-09-01T12:00:00+01:00"}, 120),
    ],
    ids=["aware-start-only", "aware-end-only"],
)
def test_partial_update_accepts_aware_focus_session_time(
    client, auth_headers, patch, expected_duration
):
    created = client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T10:00:00Z",
        },
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/focus-sessions/{created['id']}",
        json=patch,
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["duration_minutes"] == expected_duration


def test_focus_sessions_require_auth(client):
    response = client.get("/api/v1/focus-sessions/")
    assert response.status_code == 401
