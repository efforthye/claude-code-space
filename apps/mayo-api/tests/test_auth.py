import asyncio

from fastapi.testclient import TestClient

from app import auth as auth_mod
from app.main import app

client = TestClient(app)


def test_register_login_me_logout_roundtrip():
    # Fresh slate — the store persists to disk, so clear leftovers from prior runs.
    auth_mod.store.users.clear()
    auth_mod.store.sessions.clear()
    auth_mod.store.save()
    email = "tester@example.com"
    # register
    r = client.post(
        "/v1/auth/register", json={"email": email, "password": "hunter2secret", "name": "Tester"}
    )
    assert r.status_code == 201
    body = r.json()
    token = body["token"]
    assert body["user"]["email"] == email
    assert body["user"]["provider"] == "email"
    # no raw password / hash on the wire
    assert "password" not in body["user"] and "hash" not in body["user"]

    # duplicate register -> 409
    dup = client.post("/v1/auth/register", json={"email": email, "password": "hunter2secret"})
    assert dup.status_code == 409

    # me with the session
    me = client.get("/v1/auth/me", headers={"X-Mayo-Session": token})
    assert me.status_code == 200 and me.json()["email"] == email

    # wrong password -> 401
    bad = client.post("/v1/auth/login", json={"email": email, "password": "wrong-password"})
    assert bad.status_code == 401

    # correct login issues a fresh session
    ok = client.post("/v1/auth/login", json={"email": email, "password": "hunter2secret"})
    assert ok.status_code == 200 and ok.json()["token"]

    # logout invalidates the session
    assert client.post("/v1/auth/logout", headers={"X-Mayo-Session": token}).status_code == 204
    gone = client.get("/v1/auth/me", headers={"X-Mayo-Session": token})
    assert gone.status_code == 401


def test_register_rejects_bad_email_and_short_password():
    assert (
        client.post("/v1/auth/register", json={"email": "notanemail", "password": "longenough1"})
    ).status_code == 422
    assert (
        client.post("/v1/auth/register", json={"email": "a@b.co", "password": "short"})
    ).status_code == 422


def test_google_login_unconfigured_is_clean_401(monkeypatch):
    # No GOOGLE_OAUTH_CLIENT_IDS configured -> helpful 401, not a 500.
    monkeypatch.setattr(
        auth_mod, "settings", type("S", (), {"google_oauth_client_ids": []})()
    )
    r = client.post("/v1/auth/google", json={"idToken": "x" * 20})
    assert r.status_code == 401
    assert "not configured" in r.json()["detail"]


def test_google_token_audience_check(monkeypatch):
    # Simulate Google's tokeninfo verifying the token but for a different app.
    class FakeResp:
        status_code = 200

        def json(self):
            return {"aud": "other-client-id", "email": "g@example.com", "email_verified": "true"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return FakeResp()

    monkeypatch.setattr(auth_mod.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(
        auth_mod,
        "settings",
        type("S", (), {"google_oauth_client_ids": ["my-client-id"]})(),
    )
    try:
        asyncio.run(auth_mod.verify_google_id_token("tok"))
        raise AssertionError("expected ValueError")
    except ValueError as exc:
        assert "different app" in str(exc)
