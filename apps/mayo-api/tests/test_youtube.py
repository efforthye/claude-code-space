from fastapi.testclient import TestClient

from app import youtube
from app.auth import store as users
from app.main import app

client = TestClient(app)


def test_connect_requires_signin():
    assert client.post("/v1/publish/youtube/connect").status_code == 401


def test_status_reports_configured_and_connected(monkeypatch):
    user = users.create_user("yt@example.com", "YT", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    s = client.get("/v1/publish/youtube/status", headers={"X-Mayo-Session": token}).json()
    assert s["connected"] is False  # no grant yet

    users.set_youtube_token(user["id"], "refresh-tok")
    s2 = client.get("/v1/publish/youtube/status", headers={"X-Mayo-Session": token}).json()
    assert s2["connected"] is True


def test_connect_builds_consent_url(monkeypatch):
    monkeypatch.setattr(
        youtube,
        "settings",
        type(
            "S",
            (),
            {
                "youtube_client_id": "cid.apps.googleusercontent.com",
                "youtube_client_secret": "sec",
                "youtube_redirect_uri": "https://api.example/cb",
            },
        )(),
    )
    url = youtube.start_connect("u_123")
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "youtube.upload" in url and "access_type=offline" in url
    # state resolves exactly once
    state = url.split("state=")[1].split("&")[0]
    assert youtube.consume_state(state) == "u_123"
    assert youtube.consume_state(state) is None


def test_callback_rejects_bad_state():
    r = client.get("/v1/publish/youtube/callback?code=abc&state=nope")
    assert r.status_code == 400
