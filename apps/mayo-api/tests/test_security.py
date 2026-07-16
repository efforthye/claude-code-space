from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import security


def _use_key(monkeypatch, key: str) -> None:
    monkeypatch.setattr(security, "settings", SimpleNamespace(api_key=key))


def test_no_key_configured_is_open(monkeypatch):
    _use_key(monkeypatch, "")
    assert security.require_api_key(authorization=None, x_api_key=None) is None


def test_valid_bearer_token(monkeypatch):
    _use_key(monkeypatch, "s3cret")
    assert security.require_api_key(authorization="Bearer s3cret", x_api_key=None) is None


def test_valid_x_api_key_header(monkeypatch):
    _use_key(monkeypatch, "s3cret")
    assert security.require_api_key(authorization=None, x_api_key="s3cret") is None


def test_missing_key_rejected(monkeypatch):
    _use_key(monkeypatch, "s3cret")
    with pytest.raises(HTTPException) as exc:
        security.require_api_key(authorization=None, x_api_key=None)
    assert exc.value.status_code == 401


def test_wrong_key_rejected(monkeypatch):
    _use_key(monkeypatch, "s3cret")
    with pytest.raises(HTTPException) as exc:
        security.require_api_key(authorization="Bearer nope", x_api_key=None)
    assert exc.value.status_code == 401


def test_protected_endpoint_401_when_key_set(monkeypatch):
    # With a key configured, an unauthenticated /v1 call is rejected end-to-end.
    from fastapi.testclient import TestClient

    monkeypatch.setattr(security, "settings", SimpleNamespace(api_key="s3cret"))
    from app.main import app

    client = TestClient(app)
    assert client.get("/v1/catalog/tiers").status_code == 401
    ok = client.get("/v1/catalog/tiers", headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200
    # health stays open
    assert client.get("/health").status_code == 200


def test_valid_session_passes_without_key(monkeypatch):
    # The public web build carries no shared key — a signed-in user's session
    # is accepted as the credential instead.
    from app.auth import store as users

    _use_key(monkeypatch, "s3cret")
    user = users.create_user("web@example.com", "Web", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    assert security.require_api_key(authorization=None, x_api_key=None, x_mayo_session=token) is None

    with pytest.raises(HTTPException):
        security.require_api_key(authorization=None, x_api_key=None, x_mayo_session="s_bogus")


def test_auth_endpoints_open_without_key(monkeypatch):
    # register/login must be reachable by a brand-new web visitor (no key, no
    # session) — the auth router is mounted without the shared-key guard.
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setattr(security, "settings", SimpleNamespace(api_key="s3cret"))
    client = TestClient(app)
    r = client.post(
        "/v1/auth/register",
        json={"email": "openweb@example.com", "password": "pw12345678", "name": "W"},
    )
    assert r.status_code in (201, 409)  # reachable (409 if re-run) — not a 401


def test_query_param_session_accepted(monkeypatch):
    # Browser-native loaders (<video> on the web) can't send headers — a valid
    # session in ?s= must authenticate media requests.
    from app.auth import store as users

    _use_key(monkeypatch, "s3cret")
    user = users.create_user("qweb@example.com", "Q", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    assert security.require_api_key(None, None, None, s=token) is None
    with pytest.raises(HTTPException):
        security.require_api_key(None, None, None, s="s_nope")
