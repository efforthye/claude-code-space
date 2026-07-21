"""Password reset — emailed code flow + honest 501 when mail is unconfigured."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import auth as auth_mod
from app.main import app

client = TestClient(app)


def _smtp_settings(**over):
    base = {k: getattr(auth_mod.settings, k) for k in (
        "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from",
        "admin_emails",
    )}
    base.update(over)
    return SimpleNamespace(**base)


def test_reset_start_501_when_mail_unconfigured(monkeypatch):
    monkeypatch.setattr(auth_mod, "settings", _smtp_settings(smtp_host="", smtp_from=""))
    r = client.post("/v1/auth/reset/start", json={"email": "someone@example.com"})
    assert r.status_code == 501


def test_reset_full_flow(monkeypatch):
    monkeypatch.setattr(
        auth_mod, "settings",
        _smtp_settings(smtp_host="smtp.test", smtp_from="mayo@test"),
    )
    sent: list[tuple[str, str, str]] = []
    monkeypatch.setattr(auth_mod, "_send_mail", lambda to, sub, body: sent.append((to, sub, body)))

    email = "reset-flow@example.com"
    client.post(
        "/v1/auth/register",
        json={"email": email, "password": "originalpw1", "name": "Reset"},
    )

    # Unknown address: 200 (no enumeration) and NO mail sent.
    r = client.post("/v1/auth/reset/start", json={"email": "nobody@example.com"})
    assert r.status_code == 200 and not sent

    r = client.post("/v1/auth/reset/start", json={"email": email})
    assert r.status_code == 200 and len(sent) == 1
    code = auth_mod._reset_pending[email]["code"]
    assert code in sent[0][2]

    # Wrong code -> 400; right code -> new session + old password dead.
    bad = client.post(
        "/v1/auth/reset/complete",
        json={"email": email, "code": "000000" if code != "000000" else "111111",
              "newPassword": "brandnewpw1"},
    )
    assert bad.status_code == 400
    good = client.post(
        "/v1/auth/reset/complete",
        json={"email": email, "code": code, "newPassword": "brandnewpw1"},
    )
    assert good.status_code == 200
    assert good.json()["user"]["email"] == email

    old = client.post("/v1/auth/login", json={"email": email, "password": "originalpw1"})
    assert old.status_code == 401
    new = client.post("/v1/auth/login", json={"email": email, "password": "brandnewpw1"})
    assert new.status_code == 200

    # The code is one-shot.
    again = client.post(
        "/v1/auth/reset/complete",
        json={"email": email, "code": code, "newPassword": "anotherpw12"},
    )
    assert again.status_code == 400


def test_reset_revokes_existing_sessions(monkeypatch):
    monkeypatch.setattr(
        auth_mod, "settings",
        _smtp_settings(smtp_host="smtp.test", smtp_from="mayo@test"),
    )
    monkeypatch.setattr(auth_mod, "_send_mail", lambda *a: None)
    email = "reset-sessions@example.com"
    reg = client.post(
        "/v1/auth/register", json={"email": email, "password": "originalpw1"}
    )
    old_token = reg.json()["token"]
    client.post("/v1/auth/reset/start", json={"email": email})
    code = auth_mod._reset_pending[email]["code"]
    client.post(
        "/v1/auth/reset/complete",
        json={"email": email, "code": code, "newPassword": "brandnewpw1"},
    )
    me = client.get("/v1/auth/me", headers={"X-Mayo-Session": old_token})
    assert me.status_code == 401


def test_atempo_chain_factors_speeds():
    from app.compose import _atempo_chain

    assert _atempo_chain(1.0) == ""
    assert _atempo_chain(1.5) == "atempo=1.5"
    assert _atempo_chain(4.0) == "atempo=2.0,atempo=2.0"
    assert _atempo_chain(0.25) == "atempo=0.5,atempo=0.5"


def test_edit_request_keep_audio_default():
    from app.schemas import EditRequest

    req = EditRequest(clips=[{"videoId": "v1"}])
    assert req.keepAudio is True
