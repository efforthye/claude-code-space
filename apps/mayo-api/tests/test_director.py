import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.planner import DirectorMessage, DirectorTurn, MockScenarioPlanner


def _converse(messages, seconds=30, tier="standard"):
    return asyncio.run(MockScenarioPlanner().converse(messages, seconds, tier))


def test_empty_conversation_prompts_for_an_idea():
    turn = _converse([])
    assert isinstance(turn, DirectorTurn)
    assert turn.reply
    assert turn.screenplay is None
    assert turn.ready is False


def test_first_user_turn_returns_a_draft_not_ready():
    turn = _converse([DirectorMessage(role="user", content="A lighthouse keeper's last night")])
    assert turn.screenplay is not None
    assert len(turn.screenplay.scenes) >= 1
    # Durations of the drafted scenes still sum to the requested length.
    assert sum(s.seconds for s in turn.screenplay.scenes) == 30
    assert turn.ready is False


def test_approval_word_flips_ready():
    convo = [
        DirectorMessage(role="user", content="A neon city chase"),
        DirectorMessage(role="director", content="Here's a first cut…"),
        DirectorMessage(role="user", content="looks good, generate it"),
    ]
    turn = _converse(convo)
    assert turn.ready is True
    assert turn.screenplay is not None


def test_chat_endpoint_shape():
    client = TestClient(app)
    body = {
        "messages": [{"role": "user", "content": "A quiet forest at dawn"}],
        "seconds": 20,
        "tier": "standard",
    }
    res = client.post("/v1/director/chat", json=body)
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data and data["reply"]
    assert data["screenplay"] is not None
    assert data["ready"] is False
