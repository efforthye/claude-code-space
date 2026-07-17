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


def test_google_start_and_poll_flow(monkeypatch):
    # Configured -> start returns a loginId + consent URL; result is pending
    # until the callback completes it, then one-shot ready.
    from types import SimpleNamespace

    monkeypatch.setattr(
        auth_mod,
        "settings",
        SimpleNamespace(
            youtube_client_id="cid.apps.googleusercontent.com",
            youtube_client_secret="sec",
            youtube_redirect_uri="https://api.example/cb",
            google_oauth_client_ids=["cid.apps.googleusercontent.com"],
        ),
    )
    r = client.post("/v1/auth/google/start")
    assert r.status_code == 200
    login_id = r.json()["loginId"]
    assert "accounts.google.com" in r.json()["url"] and "state=login." in r.json()["url"]

    pending = client.get(f"/v1/auth/google/result?loginId={login_id}")
    assert pending.json()["status"] == "pending"

    # Simulate the callback completing the login.
    user = auth_mod.store.create_user("gflow@example.com", "G", provider="google", password=None)
    auth_mod._login_pending[login_id]["result"] = {
        "token": auth_mod.store.create_session(user["id"]),
        "user": auth_mod.to_public(user).model_dump(),
    }
    ready = client.get(f"/v1/auth/google/result?loginId={login_id}").json()
    assert ready["status"] == "ready" and ready["token"] and ready["user"]["email"] == "gflow@example.com"
    # one-shot: second poll is pending/expired again
    again = client.get(f"/v1/auth/google/result?loginId={login_id}").json()
    assert again["status"] == "pending"


def test_google_start_unconfigured_is_400(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(
        auth_mod, "settings", SimpleNamespace(youtube_client_id="", youtube_client_secret="")
    )
    assert client.post("/v1/auth/google/start").status_code == 400


def test_github_start_unconfigured_is_400():
    r = client.post("/v1/auth/github/start")
    assert r.status_code == 400


def test_github_callback_bad_state_is_400():
    r = client.get("/v1/auth/github/callback", params={"code": "x", "state": "ghlogin.nope"})
    assert r.status_code == 400


def test_apple_login_rejects_malformed_token():
    # PyJWT parses the token header before any network fetch, so a malformed
    # token fails fast with 401 (no JWKS round trip).
    r = client.post("/v1/auth/apple", json={"identityToken": "not-a-jwt"})
    assert r.status_code == 401


def test_identity_linking_and_login_via_linked_identity():
    store = auth_mod.store
    user = store.create_user("link-owner@example.com", "Owner", provider="email", password="pw12345678")

    # link a GitHub identity with a DIFFERENT email
    assert store.add_identity(user["id"], "github", "other-email@github.example")
    assert store.by_identity("github", "other-email@github.example")["id"] == user["id"]
    # idempotent
    assert store.add_identity(user["id"], "github", "other-email@github.example")
    assert len(store.users[user["id"]]["identities"]) == 1

    # the same identity cannot be claimed by another account
    other = store.create_user("link-other@example.com", "Other", provider="email", password="pw12345678")
    assert not store.add_identity(other["id"], "github", "other-email@github.example")

    # public profile lists every connected provider
    public = auth_mod.to_public(store.users[user["id"]])
    assert public.providers == ["email", "github"]


def test_google_link_flow_attaches_identity_to_current_user(monkeypatch):
    store = auth_mod.store
    user = store.create_user("link-google@example.com", "G", provider="email", password="pw12345678")
    token = store.create_session(user["id"])

    # start as a LINK request (signed in) — swap in configured settings
    from types import SimpleNamespace

    monkeypatch.setattr(
        auth_mod,
        "settings",
        SimpleNamespace(
            youtube_client_id="cid",
            youtube_client_secret="sec",
            youtube_redirect_uri="https://api.example/cb",
            google_oauth_client_ids=["cid"],
        ),
    )
    r = client.post("/v1/auth/google/start?link=true", headers={"X-Mayo-Session": token})
    assert r.status_code == 200
    login_id = r.json()["loginId"]
    assert auth_mod._login_pending[login_id]["linkUserId"] == user["id"]

    # simulate Google's callback completing with a different email
    async def fake_exchange(code):
        return {"id_token": "tok"}

    async def fake_verify(idt):
        return {"email": "second@gmail.example", "name": "G", "email_verified": True}

    from app import youtube as yt

    monkeypatch.setattr(yt, "exchange_code", fake_exchange)
    monkeypatch.setattr(auth_mod, "verify_google_id_token", fake_verify)
    asyncio.run(auth_mod.complete_google_login(login_id, "code"))

    poll = client.get(f"/v1/auth/google/result?loginId={login_id}").json()
    assert poll["status"] == "ready" and poll["linked"] == "google"
    assert store.by_identity("google", "second@gmail.example")["id"] == user["id"]

    # unauthenticated link start is rejected
    assert client.post("/v1/auth/google/start?link=true").status_code == 401
