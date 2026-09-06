from datetime import datetime, timedelta, timezone


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def test_dashboard_summary_reflects_recent_activity(client, auth_headers):
    now = datetime.now(timezone.utc)
    client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Trabajo",
            "start_time": _iso(now - timedelta(hours=2)),
            "end_time": _iso(now - timedelta(hours=1)),
        },
        headers=auth_headers,
    )

    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Remo", "muscle_group": "Espalda"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/workouts/",
        json={
            "name": "Espalda",
            "date": now.date().isoformat(),
            "sets": [{"exercise_id": exercise["id"], "reps": 10, "weight_kg": 40}],
        },
        headers=auth_headers,
    )

    response = client.get("/api/v1/analytics/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["focus_minutes_last_7_days"] >= 60
    assert data["focus_sessions_last_7_days"] >= 1
    assert data["workout_sessions_last_7_days"] >= 1
    assert data["workout_volume_last_7_days_kg"] >= 400
    assert data["current_focus_streak_days"] >= 1


def test_focus_heatmap_returns_daily_totals(client, auth_headers):
    now = datetime.now(timezone.utc)
    client.post(
        "/api/v1/focus-sessions/",
        json={
            "category": "Estudio",
            "start_time": _iso(now - timedelta(hours=1)),
            "end_time": _iso(now),
        },
        headers=auth_headers,
    )
    response = client.get("/api/v1/analytics/focus/heatmap?days=30", headers=auth_headers)
    assert response.status_code == 200
    points = response.json()
    assert any(point["value"] >= 60 for point in points)


def test_focus_heatmap_flags_trained_days(client, auth_headers):
    now = datetime.now(timezone.utc)
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Peso Muerto Rumano"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/workouts/",
        json={
            "name": "Piernas",
            "date": now.date().isoformat(),
            "sets": [{"exercise_id": exercise["id"], "reps": 10, "weight_kg": 50}],
        },
        headers=auth_headers,
    )

    response = client.get("/api/v1/analytics/focus/heatmap?days=30", headers=auth_headers)
    assert response.status_code == 200
    points = {point["date"]: point for point in response.json()}
    today_key = now.date().isoformat()
    assert points[today_key]["trained"] is True


def test_workout_volume_requires_auth(client):
    response = client.get("/api/v1/analytics/workouts/volume")
    assert response.status_code == 401
