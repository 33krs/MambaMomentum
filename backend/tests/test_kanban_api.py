from threading import Event, Thread, current_thread

from sqlalchemy import event
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.crud.crud_kanban import get_or_create_board, list_column_tasks
from app.models.user import User
from app.schemas.kanban import KanbanTaskCreate, KanbanTaskMove
from app.services.kanban import KanbanService


def _board(client, headers):
    response = client.get("/api/v1/kanban/", headers=headers)
    assert response.status_code == 200
    return response.json()


def _create_task(client, headers, column_id, title, position=0, color="#123456"):
    response = client.post(
        "/api/v1/kanban/tasks",
        headers=headers,
        json={
            "column_id": column_id,
            "position": position,
            "title": title,
            "background_color": color,
        },
    )
    assert response.status_code == 201
    return response.json()


def _tasks(board, column_id):
    return next(column["tasks"] for column in board["columns"] if column["id"] == column_id)


def test_authenticated_user_reads_its_initialized_board(client, auth_headers):
    board = _board(client, auth_headers)

    assert [column["key"] for column in board["columns"]] == [
        "pending",
        "next",
        "in_progress",
        "testing",
        "done",
    ]
    assert all(column["tasks"] == [] for column in board["columns"])


def test_create_update_and_insert_task_reloads_authoritative_order(client, auth_headers):
    board = _board(client, auth_headers)
    pending_id = board["columns"][0]["id"]

    _create_task(client, auth_headers, pending_id, "First")
    board = _create_task(client, auth_headers, pending_id, "Inserted", position=0)
    tasks = _tasks(board, pending_id)

    assert [(task["title"], task["position"]) for task in tasks] == [("Inserted", 0), ("First", 1)]
    task_id = tasks[0]["id"]
    response = client.patch(
        f"/api/v1/kanban/tasks/{task_id}",
        headers=auth_headers,
        json={"title": "Renamed", "description": "Visible in the reload"},
    )

    assert response.status_code == 200
    updated = _tasks(response.json(), pending_id)[0]
    assert updated["title"] == "Renamed"
    assert updated["description"] == "Visible in the reload"


def test_move_and_delete_keep_each_column_contiguous(client, auth_headers):
    board = _board(client, auth_headers)
    pending_id, next_id = (board["columns"][index]["id"] for index in (0, 1))
    _create_task(client, auth_headers, pending_id, "First")
    board = _create_task(client, auth_headers, pending_id, "Second", position=1)
    second_id = _tasks(board, pending_id)[1]["id"]

    response = client.patch(
        f"/api/v1/kanban/tasks/{second_id}/move",
        headers=auth_headers,
        json={"column_id": next_id, "position": 0},
    )

    assert response.status_code == 200
    assert [(task["title"], task["position"]) for task in _tasks(response.json(), pending_id)] == [
        ("First", 0)
    ]
    assert [(task["title"], task["position"]) for task in _tasks(response.json(), next_id)] == [
        ("Second", 0)
    ]

    response = client.delete(f"/api/v1/kanban/tasks/{second_id}", headers=auth_headers)
    assert response.status_code == 204
    assert _tasks(_board(client, auth_headers), next_id) == []


def test_outside_scope_resources_are_indistinguishable_from_absent(client, auth_headers, db):
    board = _board(client, auth_headers)
    pending_id = board["columns"][0]["id"]
    board = _create_task(client, auth_headers, pending_id, "Private")
    task_id = _tasks(board, pending_id)[0]["id"]

    other = User(email="other-kanban@example.com", hashed_password="not-used")
    db.add(other)
    db.flush()
    other_board = get_or_create_board(db, other.id)
    db.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(str(other.id))}"}

    assert client.get(f"/api/v1/kanban/tasks/{task_id}", headers=other_headers).status_code == 404
    assert (
        client.patch(
            f"/api/v1/kanban/tasks/{task_id}", headers=other_headers, json={"title": "Nope"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/kanban/tasks/{task_id}/move",
            headers=other_headers,
            json={"column_id": other_board.columns[0].id, "position": 0},
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/v1/kanban/tasks/{task_id}", headers=other_headers).status_code == 404
    )
    assert (
        client.post(
            "/api/v1/kanban/tasks",
            headers=auth_headers,
            json={
                "column_id": other_board.columns[0].id,
                "position": 0,
                "title": "Cross-owner",
                "background_color": "#123456",
            },
        ).status_code
        == 404
    )


def test_invalid_positions_are_rejected(client, auth_headers):
    board = _board(client, auth_headers)
    pending_id = board["columns"][0]["id"]
    invalid_create = client.post(
        "/api/v1/kanban/tasks",
        headers=auth_headers,
        json={
            "column_id": pending_id,
            "position": 1,
            "title": "Out of range",
            "background_color": "#123456",
        },
    )
    assert invalid_create.status_code == 422

    board = _create_task(client, auth_headers, pending_id, "Existing")
    task_id = _tasks(board, pending_id)[0]["id"]
    invalid_move = client.patch(
        f"/api/v1/kanban/tasks/{task_id}/move",
        headers=auth_headers,
        json={"column_id": pending_id, "position": 1},
    )
    assert invalid_move.status_code == 422


def test_service_rolls_back_a_failed_mutation(db):
    user = User(email="rollback-kanban@example.com", hashed_password="not-used")
    db.add(user)
    db.flush()
    board = get_or_create_board(db, user.id)
    db.commit()
    service = KanbanService(db)

    original_normalize = service._normalize_columns

    def fail_after_flush(columns):
        original_normalize(columns)
        raise RuntimeError("force rollback")

    service._normalize_columns = fail_after_flush

    try:
        service.create_task(
            user.id,
            KanbanTaskCreate(
                column_id=board.columns[0].id,
                position=0,
                title="Must not persist",
                background_color="#123456",
            ),
        )
    except RuntimeError:
        pass
    else:
        raise AssertionError("the test must force a failed service mutation")

    assert service.read_board(user.id).columns[0].tasks == []


def test_board_lock_serializes_competing_order_mutations(db):
    user = User(email="concurrent-kanban@example.com", hashed_password="not-used")
    db.add(user)
    db.flush()
    board = get_or_create_board(db, user.id)
    db.commit()
    pending_id = board.columns[0].id
    seed_service = KanbanService(db)
    for title in ("First", "Second", "Third"):
        seed_service.create_task(
            user.id,
            KanbanTaskCreate(
                column_id=pending_id,
                position=len(seed_service.read_board(user.id).columns[0].tasks),
                title=title,
                background_color="#123456",
            ),
        )
    task_ids = [task.id for task in seed_service.read_board(user.id).columns[0].tasks]

    session_factory = sessionmaker(autoflush=False, bind=db.get_bind())
    first_has_lock = Event()
    allow_first_to_commit = Event()
    second_attempted_lock = Event()
    second_completed = Event()
    failures = []

    def first_mutation():
        session = session_factory()
        service = KanbanService(session)
        try:

            def reverse_after_lock(locked_board):
                del locked_board
                first_has_lock.set()
                assert allow_first_to_commit.wait(timeout=5)
                tasks = list_column_tasks(session, board.id, pending_id)
                service._normalize_columns([list(reversed(tasks))])

            service._mutate(user.id, reverse_after_lock)
        except Exception as exc:  # pragma: no cover - asserted below
            failures.append(exc)
        finally:
            session.close()

    def second_mutation():
        session = session_factory()
        try:
            KanbanService(session).move_task(
                user.id, task_ids[-1], KanbanTaskMove(column_id=pending_id, position=0)
            )
        except Exception as exc:  # pragma: no cover - asserted below
            failures.append(exc)
        finally:
            second_completed.set()
            session.close()

    def observe_lock(connection, cursor, statement, parameters, context, executemany):
        del connection, cursor, parameters, context, executemany
        if current_thread().name == "kanban-second" and "FOR UPDATE" in statement.upper():
            second_attempted_lock.set()

    event.listen(db.get_bind(), "before_cursor_execute", observe_lock)
    first = Thread(target=first_mutation, name="kanban-first")
    second = Thread(target=second_mutation, name="kanban-second")
    try:
        first.start()
        assert first_has_lock.wait(timeout=5)
        second.start()
        assert second_attempted_lock.wait(timeout=5)
        assert not second_completed.is_set()
        allow_first_to_commit.set()
        first.join(timeout=5)
        assert second_completed.wait(timeout=5)
        second.join(timeout=5)
    finally:
        event.remove(db.get_bind(), "before_cursor_execute", observe_lock)
        allow_first_to_commit.set()
        first.join(timeout=5)
        second.join(timeout=5)

    assert not first.is_alive()
    assert not second.is_alive()
    assert failures == []
    db.expire_all()
    tasks = list_column_tasks(db, board.id, pending_id)
    assert {task.id for task in tasks} == set(task_ids)
    assert [task.position for task in tasks] == list(range(len(task_ids)))
