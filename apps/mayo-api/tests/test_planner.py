import asyncio
from types import SimpleNamespace

from app import planner as planner_mod
from app.planner import (
    DirectorMessage,
    LocalScenarioPlanner,
    MockScenarioPlanner,
    Screenplay,
    get_scenario_planner,
)


def test_default_planner_is_mock():
    assert isinstance(get_scenario_planner(), MockScenarioPlanner)


def test_local_backend_is_selected(monkeypatch):
    # Selection now reads the runtime backend (app-switchable), not the .env default.
    monkeypatch.setattr(planner_mod.runtime, "planner_backend", lambda: "local")
    assert isinstance(planner_mod.get_scenario_planner(), LocalScenarioPlanner)


def test_local_converse_degrades_without_server(monkeypatch):
    # No LLM server listening -> connection error -> graceful fallback, not a 500.
    monkeypatch.setattr(
        planner_mod,
        "settings",
        SimpleNamespace(
            local_llm_url="http://127.0.0.1:59999",
            local_llm_model="none",
            local_llm_timeout=1,
        ),
    )
    turn = asyncio.run(
        LocalScenarioPlanner().converse(
            [DirectorMessage(role="user", content="a quiet forest")], 10, "standard"
        )
    )
    assert turn.reply and turn.screenplay is None and turn.ready is False


def test_mock_director_replies_in_korean():
    # Korean in -> Korean out (no echoing, no language mixing) for the default mock director.
    turn = asyncio.run(
        MockScenarioPlanner().converse(
            [DirectorMessage(role="user", content="밤하늘을 나는 고양이 만들어줘")], 20, "standard"
        )
    )
    assert turn.screenplay is not None
    # Reply must contain Hangul and must not just echo the user's words back.
    assert any("가" <= ch <= "힣" for ch in turn.reply)
    assert turn.reply.strip() != "밤하늘을 나는 고양이 만들어줘"


def test_director_settings_roundtrip_and_validation(monkeypatch):
    from app import auth as auth_mod
    from app.main import app as _app
    from app.routers import admin as admin_router
    from fastapi.testclient import TestClient

    c = TestClient(_app)
    before = c.get("/v1/settings").json()
    assert "plannerBackend" in before and "directorModel" in before

    # PUT flips GLOBAL server backends, so it is admin-only; an anonymous or
    # ordinary session must bounce off.
    assert c.put("/v1/settings", json=before).status_code == 403
    admin = auth_mod.store.by_email("settings-admin@example.com") or auth_mod.store.create_user(
        "settings-admin@example.com", "A", provider="email", password="pw12345678"
    )
    token = auth_mod.store.create_session(admin["id"])
    monkeypatch.setattr(
        admin_router,
        "settings",
        type("S", (), {"admin_emails": ["settings-admin@example.com"]})(),
    )
    h = {"X-Mayo-Session": token}

    ok = c.put(
        "/v1/settings",
        json={
            "generationBackend": before["generationBackend"],
            "plannerBackend": "claude",
            "directorModel": "claude-sonnet-5",
            "byok": before["byok"],
        },
        headers=h,
    )
    assert ok.status_code == 200
    assert ok.json()["plannerBackend"] == "claude"
    assert ok.json()["directorModel"] == "claude-sonnet-5"

    bad = c.put(
        "/v1/settings",
        json={
            "generationBackend": before["generationBackend"],
            "plannerBackend": "claude",
            "directorModel": "gpt-nope",
            "byok": before["byok"],
        },
        headers=h,
    )
    assert bad.status_code == 400

    # restore original settings so test ordering stays clean
    c.put("/v1/settings", json=before, headers=h)


def test_mock_planner_scenes_sum_to_length():
    plan = asyncio.run(MockScenarioPlanner().plan("A lighthouse short", 30, "standard"))
    assert isinstance(plan, Screenplay)
    assert len(plan.scenes) >= 1
    # Per-scene durations must add up to the requested total.
    assert sum(s.seconds for s in plan.scenes) == 30
    # Scenes are indexed in order and carry a generation prompt.
    assert [s.index for s in plan.scenes] == list(range(len(plan.scenes)))
    assert all(s.prompt for s in plan.scenes)


def test_clean_reply_strips_leaked_meta():
    from app.planner import _clean_reply

    # complete bracketed stage direction
    assert _clean_reply("[reply warmly in Korean] 안녕하세요! 뭘 만들까요?") == "안녕하세요! 뭘 만들까요?"
    # truncated leading meta (opening bracket lost) — the production case
    leaked = " you fun greeting. Reply in kind. Keep in Korean.] 안녕하세요! 😊 어떻게 손볼까요?"
    assert _clean_reply(leaked) == "안녕하세요! 😊 어떻게 손볼까요?"
    # normal replies pass through untouched
    assert _clean_reply("바다 위 일출로 시작할까요?") == "바다 위 일출로 시작할까요?"
    assert _clean_reply("Let's open on a sunrise.") == "Let's open on a sunrise."
