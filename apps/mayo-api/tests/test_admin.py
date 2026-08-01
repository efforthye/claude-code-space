"""Admin console (ADR 0016) — email-gated stats, user board, moderation."""

import asyncio

from fastapi.testclient import TestClient

from app import auth as auth_mod
from app.main import app

client = TestClient(app)


def _admin_session(monkeypatch):
    user = auth_mod.store.by_email("boss@example.com") or auth_mod.store.create_user(
        "boss@example.com", "Boss", provider="email", password="pw12345678"
    )
    token = auth_mod.store.create_session(user["id"])
    from app.routers import admin as admin_router

    monkeypatch.setattr(
        admin_router, "settings", type("S", (), {"admin_emails": ["boss@example.com"]})()
    )
    return user, token


def test_admin_requires_allowed_email(monkeypatch):
    _admin_session(monkeypatch)
    # anonymous and ordinary users are locked out
    assert client.get("/v1/admin/stats").status_code == 403
    pleb = auth_mod.store.create_user("pleb@example.com", "P", provider="email", password="pw12345678")
    pleb_token = auth_mod.store.create_session(pleb["id"])
    assert client.get("/v1/admin/stats", headers={"X-Mayo-Session": pleb_token}).status_code == 403


def test_admin_stats_and_user_board(monkeypatch):
    _, token = _admin_session(monkeypatch)
    stats = client.get("/v1/admin/stats", headers={"X-Mayo-Session": token})
    assert stats.status_code == 200
    body = stats.json()
    assert body["users"] >= 1 and "storageBytes" in body and "creditsOutstanding" in body

    board = client.get("/v1/admin/users", headers={"X-Mayo-Session": token})
    assert board.status_code == 200
    assert any(u["email"] == "boss@example.com" for u in board.json())


def test_admin_credit_grant_and_plan_change(monkeypatch):
    _, token = _admin_session(monkeypatch)
    target = auth_mod.store.create_user("grantee@example.com", "G", provider="email", password="pw12345678")
    before = target["credits"]
    r = client.post(
        f"/v1/admin/users/{target['id']}/credits",
        json={"delta": 500},
        headers={"X-Mayo-Session": token},
    )
    assert r.status_code == 200 and r.json()["credits"] == before + 500

    p = client.post(
        f"/v1/admin/users/{target['id']}/plan",
        json={"planId": "pro"},
        headers={"X-Mayo-Session": token},
    )
    assert p.status_code == 200 and p.json()["planId"] == "pro"


def test_admin_explore_moderation(monkeypatch):
    from app.schemas import Video
    from app.store import explore as explore_store

    _, token = _admin_session(monkeypatch)
    video = Video(
        id="vmod", title="Mod me", durationLabel="0:02", sizeLabel="1 MB", expiresInDays=14,
        accent="#000", resolution="512p", tierLabel="Local", scenes=1, createdLabel="now",
        url="/v1/media/films/mod.mp4",
    )
    item = asyncio.run(explore_store.publish(video, "p"))
    r = client.delete(f"/v1/admin/explore/{item.id}", headers={"X-Mayo-Session": token})
    assert r.status_code == 200 and r.json()["deleted"] is True
    assert client.delete(
        f"/v1/admin/explore/{item.id}", headers={"X-Mayo-Session": token}
    ).status_code == 404


def test_admin_audit_log_and_timeseries(monkeypatch):
    """Mutating admin actions land in the audit log; stats reads accrue a daily
    metric snapshot served by /timeseries."""
    from app import db

    db.replace_kind("audit", [])
    db.replace_kind("metric_snap", [])
    _, token = _admin_session(monkeypatch)
    h = {"X-Mayo-Session": token}

    target = auth_mod.store.create_user(
        "audited@example.com", "Aud", provider="email", password="pw12345678"
    )
    r = client.post(f"/v1/admin/users/{target['id']}/credits", json={"delta": 50}, headers=h)
    assert r.status_code == 200
    r = client.post(f"/v1/admin/users/{target['id']}/plan", json={"planId": "pro"}, headers=h)
    assert r.status_code == 200

    audit = client.get("/v1/admin/audit", headers=h)
    assert audit.status_code == 200
    actions = [(a["action"], a["detail"]) for a in audit.json()]
    assert ("plan", "pro") == actions[0]  # newest first
    assert ("credits", "+50") in actions
    assert all(a["admin"] == "boss@example.com" for a in audit.json())

    # stats upserts today's snapshot; a second read updates, not duplicates
    assert client.get("/v1/admin/stats", headers=h).status_code == 200
    assert client.get("/v1/admin/stats", headers=h).status_code == 200
    series = client.get("/v1/admin/timeseries", headers=h)
    assert series.status_code == 200 and len(series.json()) == 1
    point = series.json()[0]
    assert point["users"] >= 2 and "watches" in point

    # non-admin gets nothing
    anon = client.get("/v1/admin/audit")
    assert anon.status_code == 403


def test_business_ledger_records_and_serves(monkeypatch):
    """Signups and job creation land in the ledger; /v1/admin/ledger serves
    them newest-first to admins only. Telegram unset -> silent no-op."""
    from app import db, ledger

    db.replace_kind("ledger", [])
    user = auth_mod.store.create_user(
        "ledgered@example.com", "L", provider="email", password="pw12345678"
    )
    token = auth_mod.store.create_session(user["id"])
    client.post(
        "/v1/jobs",
        json={"prompt": "ledger film", "seconds": 4, "tier": "draft"},
        headers={"X-Mayo-Session": token},
    )
    rows = ledger.entries()
    events = [r["event"] for r in rows]
    assert "signup" in events and "job_created" in events
    created = next(r for r in rows if r["event"] == "job_created")
    assert created["prompt"].startswith("ledger film")
    assert created["email"] == "ledgered@example.com"

    _, admin_token = _admin_session(monkeypatch)
    r = client.get("/v1/admin/ledger", headers={"X-Mayo-Session": admin_token})
    assert r.status_code == 200 and len(r.json()) >= 2
    assert client.get("/v1/admin/ledger").status_code == 403


def test_user_sees_only_their_own_ledger():
    from app import db

    db.replace_kind("ledger", [])
    a = auth_mod.store.create_user("mine-a@example.com", "A", provider="email", password="pw12345678")
    b = auth_mod.store.create_user("mine-b@example.com", "B", provider="email", password="pw12345678")
    ta = auth_mod.store.create_session(a["id"])
    client.post(
        "/v1/jobs", json={"prompt": "a's film", "seconds": 4, "tier": "draft"},
        headers={"X-Mayo-Session": ta},
    )
    mine = client.get("/v1/auth/me/ledger", headers={"X-Mayo-Session": ta})
    assert mine.status_code == 200
    rows = mine.json()
    assert rows and all(r["userId"] == a["id"] for r in rows)
    tb = auth_mod.store.create_session(b["id"])
    theirs = client.get("/v1/auth/me/ledger", headers={"X-Mayo-Session": tb}).json()
    assert all(r["userId"] == b["id"] for r in theirs)
    assert client.get("/v1/auth/me/ledger").status_code == 401
