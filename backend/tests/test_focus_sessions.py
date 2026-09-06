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


def test_focus_sessions_require_auth(client):
    response = client.get("/api/v1/focus-sessions/")
    assert response.status_code == 401
