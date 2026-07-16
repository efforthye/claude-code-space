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
