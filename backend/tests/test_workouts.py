def test_create_exercise(client, auth_headers):
    response = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Sentadilla", "muscle_group": "Piernas"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Sentadilla"


def test_create_exercise_is_idempotent_by_name(client, auth_headers):
    payload = {"name": "Peso Muerto", "muscle_group": "Espalda"}
    first = client.post("/api/v1/workouts/exercises", json=payload, headers=auth_headers)
    second = client.post("/api/v1/workouts/exercises", json=payload, headers=auth_headers)
    assert first.json()["id"] == second.json()["id"]


def test_create_workout_session_with_sets(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Press Banca", "muscle_group": "Pecho"},
        headers=auth_headers,
    ).json()

    response = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Día de empuje",
            "date": "2026-09-01",
            "sets": [
                {"exercise_id": exercise["id"], "set_number": 1, "reps": 8, "weight_kg": 60},
                {"exercise_id": exercise["id"], "set_number": 2, "reps": 6, "weight_kg": 65},
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["sets"]) == 2
    assert data["sets"][0]["exercise"]["name"] == "Press Banca"


def test_list_and_get_workout_session(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Dominadas", "muscle_group": "Espalda"},
        headers=auth_headers,
    ).json()
    created = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Tirón",
            "date": "2026-09-02",
            "sets": [{"exercise_id": exercise["id"], "reps": 10, "weight_kg": 0}],
        },
        headers=auth_headers,
    ).json()

    list_resp = client.get("/api/v1/workouts/", headers=auth_headers)
    assert list_resp.status_code == 200
    assert any(w["id"] == created["id"] for w in list_resp.json())

    get_resp = client.get(f"/api/v1/workouts/{created['id']}", headers=auth_headers)
    assert get_resp.status_code == 200


def test_delete_workout_session(client, auth_headers):
    created = client.post(
        "/api/v1/workouts/",
        json={"name": "Sesión vacía", "date": "2026-09-03", "sets": []},
        headers=auth_headers,
    ).json()

    delete_resp = client.delete(f"/api/v1/workouts/{created['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/v1/workouts/{created['id']}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_rename_exercise(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Curl Biceps", "muscle_group": "Brazos"},
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/workouts/exercises/{exercise['id']}",
        json={"name": "Curl de Biceps"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Curl de Biceps"


def test_rename_exercise_conflict(client, auth_headers):
    client.post("/api/v1/workouts/exercises", json={"name": "Zancadas"}, headers=auth_headers)
    other = client.post(
        "/api/v1/workouts/exercises", json={"name": "Prensa"}, headers=auth_headers
    ).json()

    response = client.put(
        f"/api/v1/workouts/exercises/{other['id']}",
        json={"name": "Zancadas"},
        headers=auth_headers,
    )
    assert response.status_code == 409


def test_delete_unused_exercise(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises", json={"name": "Elevaciones"}, headers=auth_headers
    ).json()
    response = client.delete(f"/api/v1/workouts/exercises/{exercise['id']}", headers=auth_headers)
    assert response.status_code == 204


def test_delete_exercise_in_use_keeps_history(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises", json={"name": "Remo con Barra"}, headers=auth_headers
    ).json()
    session = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Espalda",
            "date": "2026-09-04",
            "sets": [{"exercise_id": exercise["id"], "reps": 10, "weight_kg": 40}],
        },
        headers=auth_headers,
    ).json()

    delete_resp = client.delete(
        f"/api/v1/workouts/exercises/{exercise['id']}", headers=auth_headers
    )
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/v1/workouts/{session['id']}", headers=auth_headers)
    assert get_resp.status_code == 200
    set_data = get_resp.json()["sets"][0]
    assert set_data["exercise_id"] is None
    assert set_data["exercise"] is None
    assert set_data["exercise_name"] == "Remo con Barra"


def test_workout_template_create_apply_and_delete(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises", json={"name": "Sentadilla Frontal"}, headers=auth_headers
    ).json()

    template = client.post(
        "/api/v1/workouts/templates",
        json={"name": "Pull", "items": [{"exercise_id": exercise["id"], "sets_count": 3}]},
        headers=auth_headers,
    ).json()
    assert len(template["items"]) == 1

    applied = client.post(
        f"/api/v1/workouts/templates/{template['id']}/apply",
        json={"date": "2026-09-05"},
        headers=auth_headers,
    )
    assert applied.status_code == 201
    applied_data = applied.json()
    assert applied_data["name"] == "Pull"
    assert len(applied_data["sets"]) == 3
    assert all(s["reps"] == 0 for s in applied_data["sets"])

    delete_resp = client.delete(
        f"/api/v1/workouts/templates/{template['id']}", headers=auth_headers
    )
    assert delete_resp.status_code == 204


def test_update_workout_session_replaces_sets(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises", json={"name": "Press Militar"}, headers=auth_headers
    ).json()
    session = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Hombro",
            "date": "2026-09-06",
            "sets": [{"exercise_id": exercise["id"], "reps": 1, "weight_kg": 0}],
        },
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/workouts/{session['id']}",
        json={
            "sets": [
                {"exercise_id": exercise["id"], "set_number": 1, "reps": 8, "weight_kg": 20},
                {"exercise_id": exercise["id"], "set_number": 2, "reps": 8, "weight_kg": 22},
            ]
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["sets"]) == 2
    assert data["sets"][0]["reps"] == 8
