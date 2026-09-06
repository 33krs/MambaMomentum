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
