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


def _register_and_login(client, email: str) -> dict[str, str]:
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert registration.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "password123"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _create_focus_session(client, headers: dict[str, str], start: datetime, end: datetime):
    response = client.post(
        "/api/v1/focus-sessions/",
        json={"category": "Trabajo", "start_time": _iso(start), "end_time": _iso(end)},
        headers=headers,
    )
    assert response.status_code == 201


def _create_workout(client, headers: dict[str, str], name: str, sets: list[dict[str, int | float]]):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": name},
        headers=headers,
    )
    assert exercise.status_code == 201

    response = client.post(
        "/api/v1/workouts/",
        json={
            "name": name,
            "date": datetime.now(timezone.utc).date().isoformat(),
            "sets": [{"exercise_id": exercise.json()["id"], **workout_set} for workout_set in sets],
        },
        headers=headers,
    )
    assert response.status_code == 201


def test_dashboard_summary_isolates_another_users_activity(client, auth_headers):
    now = datetime.now(timezone.utc)
    _create_focus_session(client, auth_headers, now - timedelta(hours=2), now - timedelta(hours=1))
    _create_workout(client, auth_headers, "Remo aislado", [{"reps": 10, "weight_kg": 20}])

    other_headers = _register_and_login(client, "analytics-summary-other@example.com")
    _create_focus_session(client, other_headers, now - timedelta(hours=6), now - timedelta(hours=1))
    _create_workout(client, other_headers, "Remo externo", [{"reps": 10, "weight_kg": 100}])

    response = client.get("/api/v1/analytics/summary", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "focus_minutes_last_7_days": 60,
        "focus_sessions_last_7_days": 1,
        "workout_sessions_last_7_days": 1,
        "workout_volume_last_7_days_kg": 200.0,
        "current_focus_streak_days": 1,
    }


def test_focus_heatmap_isolates_activity_and_training_by_user(client, auth_headers):
    now = datetime.now(timezone.utc)
    _create_focus_session(
        client, auth_headers, now - timedelta(hours=2), now - timedelta(hours=1, minutes=30)
    )
    _create_workout(client, auth_headers, "Sentadilla aislada", [{"reps": 5, "weight_kg": 20}])

    other_headers = _register_and_login(client, "analytics-heatmap-other@example.com")
    _create_focus_session(client, other_headers, now - timedelta(hours=5), now - timedelta(hours=1))

    response = client.get("/api/v1/analytics/focus/heatmap?days=1", headers=auth_headers)

    assert response.status_code == 200
    today = now.date().isoformat()
    points = {point["date"]: point for point in response.json()}
    assert points[today] == {"date": today, "value": 30.0, "trained": True}


def test_focus_trends_isolate_weekly_totals_by_user(client, auth_headers):
    now = datetime.now(timezone.utc)
    _create_focus_session(
        client, auth_headers, now - timedelta(hours=5), now - timedelta(hours=4, minutes=30)
    )
    _create_focus_session(client, auth_headers, now - timedelta(hours=3), now - timedelta(hours=2))

    other_headers = _register_and_login(client, "analytics-trends-other@example.com")
    _create_focus_session(
        client, other_headers, now - timedelta(hours=12), now - timedelta(hours=2)
    )

    response = client.get("/api/v1/analytics/focus/trends?weeks=1", headers=auth_headers)

    assert response.status_code == 200
    week_start = (now.date() - timedelta(days=now.weekday())).isoformat()
    assert response.json() == [
        {
            "period_start": week_start,
            "total_minutes": 90,
            "session_count": 2,
            "avg_session_minutes": 45.0,
        }
    ]


def test_workout_volume_isolates_sets_by_user(client, auth_headers):
    _create_workout(
        client,
        auth_headers,
        "Press aislado",
        [{"reps": 10, "weight_kg": 20}, {"reps": 5, "weight_kg": 10}],
    )

    other_headers = _register_and_login(client, "analytics-volume-other@example.com")
    _create_workout(client, other_headers, "Press externo", [{"reps": 10, "weight_kg": 100}])

    response = client.get("/api/v1/analytics/workouts/volume?weeks=1", headers=auth_headers)

    assert response.status_code == 200
    week_start = (
        datetime.now(timezone.utc).date() - timedelta(days=datetime.now(timezone.utc).weekday())
    ).isoformat()
    assert response.json() == [
        {"period_start": week_start, "total_volume_kg": 250.0, "total_sets": 2}
    ]
