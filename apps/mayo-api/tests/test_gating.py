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
