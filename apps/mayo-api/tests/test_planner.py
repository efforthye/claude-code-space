import asyncio

from app.planner import MockScenarioPlanner, Screenplay, get_scenario_planner


def test_default_planner_is_mock():
    assert isinstance(get_scenario_planner(), MockScenarioPlanner)


def test_mock_planner_scenes_sum_to_length():
    plan = asyncio.run(MockScenarioPlanner().plan("A lighthouse short", 30, "standard"))
    assert isinstance(plan, Screenplay)
    assert len(plan.scenes) >= 1
    # Per-scene durations must add up to the requested total.
    assert sum(s.seconds for s in plan.scenes) == 30
    # Scenes are indexed in order and carry a generation prompt.
    assert [s.index for s in plan.scenes] == list(range(len(plan.scenes)))
    assert all(s.prompt for s in plan.scenes)
