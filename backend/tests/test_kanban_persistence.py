import pytest
from sqlalchemy.exc import IntegrityError

from app.crud.crud_kanban import create_task, get_or_create_board, get_task
from app.crud.crud_user import create_user as register_user
from app.models.kanban import KANBAN_COLUMNS, KanbanBoard, KanbanColumn, KanbanTask
from app.models.user import User
from app.schemas.user import UserCreate


def create_user(db, email: str) -> User:
    user = User(email=email, hashed_password="not-used")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_board_initialization_is_idempotent_and_creates_fixed_columns(db):
    user = create_user(db, "kanban@example.com")

    first = get_or_create_board(db, user.id)
    second = get_or_create_board(db, user.id)

    assert first.id == second.id
    assert db.query(KanbanBoard).filter(KanbanBoard.user_id == user.id).count() == 1
    assert [(column.key, column.name, column.position) for column in second.columns] == [
        (key, name, position) for position, (key, name) in enumerate(KANBAN_COLUMNS)
    ]


def test_registering_an_account_initializes_its_personal_board(db):
    user = register_user(
        db,
        UserCreate(
            email="new-account@example.com", password="supersecret123", full_name="New Account"
        ),
    )

    board = db.query(KanbanBoard).filter(KanbanBoard.user_id == user.id).one()

    assert [column.key for column in board.columns] == [key for key, _ in KANBAN_COLUMNS]


def test_board_and_column_constraints_prevent_ambiguous_ownership_and_order(db):
    user = create_user(db, "constraints@example.com")
    board = get_or_create_board(db, user.id)

    duplicate_board = KanbanBoard(user_id=user.id)
    db.add(duplicate_board)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    duplicate_position = KanbanColumn(board_id=board.id, key="another", name="Another", position=0)
    db.add(duplicate_position)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_task_constraints_enforce_its_board_column_color_and_position(db):
    first_user = create_user(db, "first@example.com")
    second_user = create_user(db, "second@example.com")
    first_board = get_or_create_board(db, first_user.id)
    second_board = get_or_create_board(db, second_user.id)
    first_column = first_board.columns[0]
    second_column = second_board.columns[0]

    task = KanbanTask(
        board_id=first_board.id,
        column_id=first_column.id,
        title="Valid task",
        background_color="#12aBcD",
        position=0,
    )
    db.add(task)
    db.commit()

    mismatched_column = KanbanTask(
        board_id=first_board.id,
        column_id=second_column.id,
        title="Wrong board",
        background_color="#123456",
        position=1,
    )
    db.add(mismatched_column)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    duplicate_position = KanbanTask(
        board_id=first_board.id,
        column_id=first_column.id,
        title="Duplicate position",
        background_color="#123456",
        position=0,
    )
    db.add(duplicate_position)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    invalid_color = KanbanTask(
        board_id=first_board.id,
        column_id=first_column.id,
        title="Invalid color",
        background_color="blue",
        position=1,
    )
    db.add(invalid_color)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_task_crud_scopes_resources_to_the_board_owner(db):
    owner = create_user(db, "owner@example.com")
    other_user = create_user(db, "other@example.com")
    owner_board = get_or_create_board(db, owner.id)
    other_board = get_or_create_board(db, other_user.id)

    task = create_task(
        db,
        owner.id,
        owner_board.columns[0].id,
        "Owner task",
        "#abcdef",
        0,
        "Private task",
    )

    assert task is not None
    assert get_task(db, task.id, owner.id) is not None
    assert get_task(db, task.id, other_user.id) is None
    assert (
        create_task(
            db,
            owner.id,
            other_board.columns[0].id,
            "Cross-owner task",
            "#abcdef",
            1,
        )
        is None
    )


def test_deleting_a_user_cascades_its_board_columns_and_tasks(db):
    user = create_user(db, "cascade@example.com")
    board = get_or_create_board(db, user.id)
    task = create_task(db, user.id, board.columns[0].id, "Task", "#112233", 0)
    assert task is not None

    db.delete(user)
    db.commit()

    assert db.query(KanbanBoard).filter(KanbanBoard.id == board.id).one_or_none() is None
    assert db.query(KanbanColumn).filter(KanbanColumn.board_id == board.id).count() == 0
    assert db.query(KanbanTask).filter(KanbanTask.id == task.id).one_or_none() is None
