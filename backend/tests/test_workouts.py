import pytest
from sqlalchemy.exc import IntegrityError

from app.models.workout import Exercise


def register_and_login(client, email):
    password = "supersecret123"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Another user"},
    )
    response = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_create_exercise(client, auth_headers):
    response = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Sentadilla", "muscle_group": "Piernas"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Sentadilla"
    assert response.json()["is_system"] is False


def test_create_exercise_is_idempotent_by_name(client, auth_headers):
    payload = {"name": "Peso Muerto", "muscle_group": "Espalda"}
    first = client.post("/api/v1/workouts/exercises", json=payload, headers=auth_headers)
    second = client.post("/api/v1/workouts/exercises", json=payload, headers=auth_headers)
    assert first.json()["id"] == second.json()["id"]


def test_exercise_catalog_lists_system_and_current_users_exercises_only(client, auth_headers, db):
    system_exercise = Exercise(name="System Squat")
    db.add(system_exercise)
    db.commit()
    other_headers = register_and_login(client, "other@example.com")
    other_exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Other Private Exercise"},
        headers=other_headers,
    ).json()
    own_exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "My Private Exercise"},
        headers=auth_headers,
    ).json()

    response = client.get("/api/v1/workouts/exercises", headers=auth_headers)

    assert response.status_code == 200
    exercises = {exercise["id"]: exercise for exercise in response.json()}
    assert exercises[system_exercise.id]["is_system"] is True
    assert exercises[own_exercise["id"]]["is_system"] is False
    assert other_exercise["id"] not in exercises


def test_retired_system_exercise_is_hidden_from_catalog_but_remains_usable(
    client, auth_headers, db
):
    retired = Exercise(name="Press Banca Smoke2", catalog_visible=False)
    db.add(retired)
    db.commit()

    catalog = client.get("/api/v1/workouts/exercises", headers=auth_headers)
    workout = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Historical reference",
            "date": "2026-09-08",
            "sets": [{"exercise_id": retired.id, "reps": 5, "weight_kg": 50}],
        },
        headers=auth_headers,
    )

    assert catalog.status_code == 200
    assert retired.id not in {exercise["id"] for exercise in catalog.json()}
    assert workout.status_code == 201


def test_system_exercise_is_read_only_but_can_be_used(client, auth_headers, db):
    system_exercise = Exercise(name="System Bench Press")
    db.add(system_exercise)
    db.commit()

    rename = client.put(
        f"/api/v1/workouts/exercises/{system_exercise.id}",
        json={"name": "Changed"},
        headers=auth_headers,
    )
    delete = client.delete(f"/api/v1/workouts/exercises/{system_exercise.id}", headers=auth_headers)
    workout = client.post(
        "/api/v1/workouts/",
        json={
            "name": "System exercise workout",
            "date": "2026-09-08",
            "sets": [
                {
                    "exercise_id": system_exercise.id,
                    "reps": 5,
                    "weight_kg": 50,
                }
            ],
        },
        headers=auth_headers,
    )

    assert rename.status_code == 404
    assert delete.status_code == 404
    assert workout.status_code == 201


def test_user_cannot_discover_or_mutate_another_users_exercise(client, auth_headers):
    other_headers = register_and_login(client, "private-owner@example.com")
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Private Curl"},
        headers=other_headers,
    ).json()

    rename = client.put(
        f"/api/v1/workouts/exercises/{exercise['id']}",
        json={"name": "Stolen Curl"},
        headers=auth_headers,
    )
    delete = client.delete(f"/api/v1/workouts/exercises/{exercise['id']}", headers=auth_headers)
    workout = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Unauthorized",
            "date": "2026-09-08",
            "sets": [{"exercise_id": exercise["id"], "reps": 5, "weight_kg": 10}],
        },
        headers=auth_headers,
    )
    template = client.post(
        "/api/v1/workouts/templates",
        json={
            "name": "Unauthorized",
            "items": [{"exercise_id": exercise["id"], "sets_count": 1}],
        },
        headers=auth_headers,
    )

    assert rename.status_code == 404
    assert delete.status_code == 404
    assert workout.status_code == 404
    assert template.status_code == 404


def test_workout_update_rejects_another_users_exercise_without_losing_sets(client, auth_headers):
    own_exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Owned Row"},
        headers=auth_headers,
    ).json()
    workout = client.post(
        "/api/v1/workouts/",
        json={
            "name": "Protected workout",
            "date": "2026-09-08",
            "sets": [{"exercise_id": own_exercise["id"], "reps": 8, "weight_kg": 10}],
        },
        headers=auth_headers,
    ).json()
    other_headers = register_and_login(client, "update-owner@example.com")
    other_exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Other Row"},
        headers=other_headers,
    ).json()

    response = client.put(
        f"/api/v1/workouts/{workout['id']}",
        json={"sets": [{"exercise_id": other_exercise["id"], "reps": 3, "weight_kg": 20}]},
        headers=auth_headers,
    )
    persisted = client.get(f"/api/v1/workouts/{workout['id']}", headers=auth_headers).json()

    assert response.status_code == 404
    assert len(persisted["sets"]) == 1
    assert persisted["sets"][0]["exercise_id"] == own_exercise["id"]


def test_different_users_can_use_the_same_custom_exercise_name(client, auth_headers):
    other_headers = register_and_login(client, "same-name@example.com")

    first = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Personal Squat"},
        headers=auth_headers,
    )
    second = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "personal squat"},
        headers=other_headers,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


def test_custom_exercise_cannot_duplicate_visible_system_name(client, auth_headers, db):
    db.add(Exercise(name="System Deadlift"))
    db.commit()

    response = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "system deadlift"},
        headers=auth_headers,
    )

    assert response.status_code == 409


def test_exercise_catalog_requires_authentication(client):
    response = client.get("/api/v1/workouts/exercises")
    assert response.status_code == 401


def test_database_rejects_case_insensitive_duplicate_system_exercise_names(db, auth_headers):
    db.add_all([Exercise(name="System Row"), Exercise(name="system row")])

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


@pytest.mark.parametrize("name", ["   ", "\t\n"], ids=["spaces", "mixed-whitespace"])
def test_database_rejects_blank_exercise_names(db, auth_headers, name):
    db.add(Exercise(name=name))

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


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


def test_rename_exercise_rejects_null_name(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Valid Name"},
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/workouts/exercises/{exercise['id']}",
        json={"name": None},
        headers=auth_headers,
    )

    assert response.status_code == 422


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


def test_deleted_exercise_keeps_template_snapshot_usable(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Snapshot Row"},
        headers=auth_headers,
    ).json()
    template = client.post(
        "/api/v1/workouts/templates",
        json={
            "name": "Snapshot template",
            "items": [{"exercise_id": exercise["id"], "sets_count": 1}],
        },
        headers=auth_headers,
    ).json()

    delete_response = client.delete(
        f"/api/v1/workouts/exercises/{exercise['id']}", headers=auth_headers
    )
    applied = client.post(
        f"/api/v1/workouts/templates/{template['id']}/apply",
        json={"date": "2026-09-08"},
        headers=auth_headers,
    )

    assert delete_response.status_code == 204
    assert applied.status_code == 201
    assert applied.json()["sets"][0]["exercise_id"] is None
    assert applied.json()["sets"][0]["exercise_name"] == "Snapshot Row"


def test_template_snapshot_keeps_last_name_after_rename_delete_and_apply(client, auth_headers):
    exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Original Template Name"},
        headers=auth_headers,
    ).json()
    template = client.post(
        "/api/v1/workouts/templates",
        json={
            "name": "Renamed exercise template",
            "items": [{"exercise_id": exercise["id"], "sets_count": 1}],
        },
        headers=auth_headers,
    ).json()

    renamed = client.put(
        f"/api/v1/workouts/exercises/{exercise['id']}",
        json={"name": "Latest Template Name"},
        headers=auth_headers,
    )
    deleted = client.delete(f"/api/v1/workouts/exercises/{exercise['id']}", headers=auth_headers)
    applied = client.post(
        f"/api/v1/workouts/templates/{template['id']}/apply",
        json={"date": "2026-09-08"},
        headers=auth_headers,
    )

    assert renamed.status_code == 200
    assert deleted.status_code == 204
    assert applied.status_code == 201
    assert applied.json()["sets"][0]["exercise_id"] is None
    assert applied.json()["sets"][0]["exercise_name"] == "Latest Template Name"


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


def test_update_workout_template_persists_owner_draft_without_recreating(client, auth_headers):
    first = client.post(
        "/api/v1/workouts/exercises", json={"name": "Template First"}, headers=auth_headers
    ).json()
    second = client.post(
        "/api/v1/workouts/exercises", json={"name": "Template Second"}, headers=auth_headers
    ).json()
    template = client.post(
        "/api/v1/workouts/templates",
        json={"name": "Original", "items": [{"exercise_id": first["id"], "sets_count": 1}]},
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/workouts/templates/{template['id']}",
        json={
            "name": "Updated",
            "items": [{"exercise_id": second["id"], "sets_count": 3, "order_index": 0}],
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == template["id"]
    assert response.json()["name"] == "Updated"
    assert response.json()["items"][0]["exercise_id"] == second["id"]
    assert response.json()["items"][0]["sets_count"] == 3


def test_update_workout_template_rejects_another_users_exercise(client, auth_headers):
    own = client.post(
        "/api/v1/workouts/exercises", json={"name": "Template Owned"}, headers=auth_headers
    ).json()
    template = client.post(
        "/api/v1/workouts/templates",
        json={"name": "Owned template", "items": [{"exercise_id": own["id"], "sets_count": 1}]},
        headers=auth_headers,
    ).json()
    other_headers = register_and_login(client, "template-update-owner@example.com")
    other = client.post(
        "/api/v1/workouts/exercises", json={"name": "Other Template"}, headers=other_headers
    ).json()

    response = client.put(
        f"/api/v1/workouts/templates/{template['id']}",
        json={"name": "Unauthorized", "items": [{"exercise_id": other["id"], "sets_count": 1}]},
        headers=auth_headers,
    )
    persisted = client.get("/api/v1/workouts/templates", headers=auth_headers).json()

    assert response.status_code == 404
    assert persisted[0]["name"] == "Owned template"


def test_update_another_users_template_is_inaccessible_and_does_not_mutate(client, auth_headers):
    owner_headers = register_and_login(client, "template-owner@example.com")
    owner_exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Owner Template Exercise"},
        headers=owner_headers,
    ).json()
    template = client.post(
        "/api/v1/workouts/templates",
        json={
            "name": "Private template",
            "items": [{"exercise_id": owner_exercise["id"], "sets_count": 2}],
        },
        headers=owner_headers,
    ).json()
    attacker_exercise = client.post(
        "/api/v1/workouts/exercises",
        json={"name": "Attacker Template Exercise"},
        headers=auth_headers,
    ).json()

    response = client.put(
        f"/api/v1/workouts/templates/{template['id']}",
        json={
            "name": "Mutated template",
            "items": [{"exercise_id": attacker_exercise["id"], "sets_count": 9}],
        },
        headers=auth_headers,
    )
    owner_templates = client.get("/api/v1/workouts/templates", headers=owner_headers).json()

    assert response.status_code == 404
    assert owner_templates == [template]
