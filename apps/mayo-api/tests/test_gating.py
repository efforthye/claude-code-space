from fastapi.testclient import TestClient

from app.auth import store as users
from app.main import app
from app.routers import director as director_router
from app.routers import jobs as jobs_router

client = TestClient(app)

_GATED = type("S", (), {"premium_gating": True})()


def test_gating_off_by_default_allows_everyone():
    r = client.post(
        "/v1/director/chat",
        json={"messages": [{"role": "user", "content": "a forest"}], "seconds": 10},
    )
    assert r.status_code == 200


def test_claude_director_gated_for_free_users(monkeypatch):
    monkeypatch.setattr(director_router, "settings", _GATED)
    monkeypatch.setattr(director_router.runtime, "planner_backend", lambda: "claude")

    body = {"messages": [{"role": "user", "content": "a forest"}], "seconds": 10}
    # anonymous -> blocked
    assert client.post("/v1/director/chat", json=body).status_code == 402

    # paid user -> allowed through the gate (mock/claude planner still runs after)
    user = users.create_user("vip@example.com", "VIP", provider="email", password="pw12345678")
    users.set_plan(user["id"], "studio")
    token = users.create_session(user["id"])
    monkeypatch.setattr(director_router.runtime, "planner_backend", lambda: "claude")
    # switch planner selection back to mock inside the planner module so the call
    # completes without an API key — the gate itself is what we're testing.
    from app import planner as planner_mod

    monkeypatch.setattr(planner_mod.runtime, "planner_backend", lambda: "mock")
    ok = client.post("/v1/director/chat", json=body, headers={"X-Mayo-Session": token})
    assert ok.status_code == 200


def test_external_generation_gated_for_free_users(monkeypatch):
    monkeypatch.setattr(jobs_router, "settings", _GATED)
    monkeypatch.setattr(jobs_router.runtime, "generation_backend", lambda: "external")
    r = client.post("/v1/jobs", json={"prompt": "x", "seconds": 4, "tier": "draft"})
    assert r.status_code == 402


def test_admin_passes_premium_gate(monkeypatch):
    """Admins use paid features without buying a plan (owner tests everything)."""
    from types import SimpleNamespace

    from app import auth as auth_mod

    monkeypatch.setattr(jobs_router, "settings", _GATED)
    monkeypatch.setattr(jobs_router.runtime, "generation_backend", lambda: "external")
    monkeypatch.setattr(
        auth_mod, "settings", SimpleNamespace(admin_emails=["gate-admin@example.com"])
    )
    admin = users.create_user("gate-admin@example.com", "A", provider="email", password="pw12345678")
    users.add_credits(admin["id"], 1000)
    token = users.create_session(admin["id"])
    # admin passes the 402 gate (still free plan) — generation itself proceeds
    r = client.post(
        "/v1/jobs",
        json={"prompt": "x", "seconds": 4, "tier": "draft"},
        headers={"X-Mayo-Session": token},
    )
    assert r.status_code == 201

    # an ordinary free user is still blocked
    pleb = users.create_user("gate-pleb@example.com", "P", provider="email", password="pw12345678")
    pleb_token = users.create_session(pleb["id"])
    blocked = client.post(
        "/v1/jobs",
        json={"prompt": "x", "seconds": 4, "tier": "draft"},
        headers={"X-Mayo-Session": pleb_token},
    )
    assert blocked.status_code == 402
