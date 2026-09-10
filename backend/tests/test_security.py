from datetime import timedelta

from app.core.security import create_access_token, decode_access_token


def test_access_token_round_trip() -> None:
    token = create_access_token("user@example.com")

    assert decode_access_token(token) == "user@example.com"


def test_expired_access_token_is_rejected() -> None:
    token = create_access_token("user@example.com", expires_delta=timedelta(seconds=-1))

    assert decode_access_token(token) is None


def test_malformed_access_token_is_rejected() -> None:
    assert decode_access_token("not-a-jwt") is None
