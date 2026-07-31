"""Auth events must record where the sign-in came from, in a parseable shape."""

import importlib
import json

from fastapi.testclient import TestClient

from app import auth as auth_mod
from app.main import app

client = TestClient(app)

# Headers a request carries once it has passed through the Cloudflare tunnel.
CF = {"CF-Connecting-IP": "203.0.113.47", "CF-IPCountry": "KR", "User-Agent": "mayo-test/1.0"}


def _reset_users():
    auth_mod.store.users.clear()
    auth_mod.store.sessions.clear()
    auth_mod.store.save()


def _read(path):
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def _isolated_log(tmp_path, monkeypatch, ip_mode="full"):
    """Point the access log at a temp file and reload the module to pick it up."""
    log = tmp_path / "auth.log"
    monkeypatch.setenv("MAYO_ACCESS_LOG", str(log))
    monkeypatch.setenv("MAYO_ACCESS_LOG_IP", ip_mode)
    import app.access_log as al

    importlib.reload(al)
    # The router imported the functions by value, so rebind them there too.
    import app.routers.auth as auth_router

    monkeypatch.setattr(auth_router, "log_auth_event", al.log_auth_event)
    monkeypatch.setattr(auth_router, "stamp_last_login", al.stamp_last_login)
    return log, al


def test_login_records_ip_country_and_outcome(tmp_path, monkeypatch):
    log, _ = _isolated_log(tmp_path, monkeypatch)
    _reset_users()
    email = "geo@example.com"

    r = client.post(
        "/v1/auth/register", json={"email": email, "password": "hunter2secret"}, headers=CF
    )
    assert r.status_code == 201

    # Wrong password — recorded as a failure, with the attempted address.
    bad = client.post("/v1/auth/login", json={"email": email, "password": "nope-nope"}, headers=CF)
    assert bad.status_code == 401

    ok = client.post(
        "/v1/auth/login", json={"email": email, "password": "hunter2secret"}, headers=CF
    )
    assert ok.status_code == 200

    events = _read(log)
    actions = [(e["event"]["action"], e["event"]["outcome"]) for e in events]
    assert ("register", "success") in actions
    assert ("login", "failure") in actions
    assert ("login", "success") in actions

    for e in events:
        assert e["client"]["ip"] == "203.0.113.47"
        assert e["client"]["geo"]["country_iso_code"] == "KR"
        assert e["service"]["name"] == "mayo-api"
        assert e["user_agent"]["original"] == "mayo-test/1.0"
        assert e["@timestamp"].endswith("Z")

    failure = next(e for e in events if e["event"]["outcome"] == "failure")
    assert failure["event"]["reason"] == "bad_credentials"
    assert failure["user"]["email"] == email
    # The password must never reach the log, in any field.
    assert "hunter2secret" not in log.read_text()

    # The account remembers its latest origin for the admin console.
    user = auth_mod.store.by_email(email)
    assert user["lastLoginIp"] == "203.0.113.47"
    assert user["lastLoginCountry"] == "KR"
    assert user["lastLoginAt"] > 0


def test_ip_can_be_masked_and_unknown_country_is_not_invented(tmp_path, monkeypatch):
    log, _ = _isolated_log(tmp_path, monkeypatch, ip_mode="masked")
    _reset_users()

    # XX is Cloudflare's "could not determine" — it must not be stored as a country.
    r = client.post(
        "/v1/auth/register",
        json={"email": "masked@example.com", "password": "hunter2secret"},
        headers={"CF-Connecting-IP": "198.51.100.200", "CF-IPCountry": "XX"},
    )
    assert r.status_code == 201

    event = _read(log)[0]
    assert event["client"]["ip"] == "198.51.100.0"  # host portion zeroed
    assert event["client"]["geo"]["country_iso_code"] == ""


def test_no_cloudflare_headers_means_no_guessed_country(tmp_path, monkeypatch):
    log, _ = _isolated_log(tmp_path, monkeypatch)
    _reset_users()

    r = client.post(
        "/v1/auth/register", json={"email": "lan@example.com", "password": "hunter2secret"}
    )
    assert r.status_code == 201

    event = _read(log)[0]
    assert event["client"]["geo"]["country_iso_code"] == ""
    assert event["event"]["action"] == "register"
