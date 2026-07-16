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
    monkeypatch.setattr(planner_mod, "settings", SimpleNamespace(planner_backend="local"))
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


def test_mock_planner_scenes_sum_to_length():
    plan = asyncio.run(MockScenarioPlanner().plan("A lighthouse short", 30, "standard"))
    assert isinstance(plan, Screenplay)
    assert len(plan.scenes) >= 1
    # Per-scene durations must add up to the requested total.
    assert sum(s.seconds for s in plan.scenes) == 30
    # Scenes are indexed in order and carry a generation prompt.
    assert [s.index for s in plan.scenes] == list(range(len(plan.scenes)))
    assert all(s.prompt for s in plan.scenes)
