"""Credits: charge at job create, pro-rata refund on cancel (ADR 0014).

Cancel a 6-scene job after 2 rendered scenes → 4/6 of the charge comes back.
"""

from fastapi.testclient import TestClient

from app.auth import store as users
from app.main import app
from app.schemas import Job
from app.store import jobs as job_store

client = TestClient(app)


def _signup(email: str):
    user = users.create_user(email, "Tester", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    return user, token


def test_signup_grants_credits():
    user, _ = _signup("credits-grant@example.com")
    assert user["credits"] == 100


def test_job_create_charges_signed_in_user():
    user, token = _signup("credits-charge@example.com")
    r = client.post(
        "/v1/jobs",
        json={"prompt": "a quiet forest", "seconds": 4, "tier": "draft"},
        headers={"X-Mayo-Session": token},
    )
    assert r.status_code == 201
    job = r.json()
    charged = job["chargedCredits"]
    assert charged and charged >= 1
    assert users.users[user["id"]]["credits"] == 100 - charged


def test_job_create_rejects_insufficient_credits():
    user, token = _signup("credits-broke@example.com")
    users.users[user["id"]]["credits"] = 0
    r = client.post(
        "/v1/jobs",
        json={"prompt": "x", "seconds": 4, "tier": "draft"},
        headers={"X-Mayo-Session": token},
    )
    assert r.status_code == 402


def test_anonymous_job_is_not_charged():
    r = client.post("/v1/jobs", json={"prompt": "x", "seconds": 4, "tier": "draft"})
    assert r.status_code == 201
    assert r.json()["chargedCredits"] is None


def test_cancel_refunds_unrendered_share_pro_rata():
    # Deterministic: craft the job state directly (2 of 6 scenes rendered,
    # 30 credits charged) instead of racing the live worker.
    user, token = _signup("credits-refund@example.com")
    users.users[user["id"]]["credits"] = 40
    jid = "jtest-prorata"
    job_store._jobs[jid] = Job(
        id=jid, title="t", status="generating", scenesDone=2, scenesTotal=6, chargedCredits=30
    )
    job_store._owners[jid] = user["id"]

    # An owned job can only be cancelled by its owner (ownership guard).
    r = client.delete(f"/v1/jobs/{jid}", headers={"X-Mayo-Session": token})
    assert r.status_code == 200
    body = r.json()
    assert body["refundedCredits"] == 20  # 4/6 of 30
    assert body["credits"] == 60
    assert users.users[user["id"]]["credits"] == 60


def test_cancel_done_job_refunds_nothing():
    user, token = _signup("credits-done@example.com")
    users.users[user["id"]]["credits"] = 10
    jid = "jtest-done"
    job_store._jobs[jid] = Job(
        id=jid, title="t", status="done", scenesDone=6, scenesTotal=6, chargedCredits=30
    )
    job_store._owners[jid] = user["id"]

    r = client.delete(f"/v1/jobs/{jid}", headers={"X-Mayo-Session": token})
    assert r.status_code == 200
    assert r.json()["refundedCredits"] == 0
    assert users.users[user["id"]]["credits"] == 10


def test_style_prompt_rides_along_to_the_job():
    style = "watercolor, a small orange tabby cat wearing a tiny red scarf"
    r = client.post(
        "/v1/jobs",
        json={
            "prompt": "cat story",
            "seconds": 4,
            "tier": "draft",
            "scenePrompts": ["the cat walks along a rooftop"],
            "stylePrompt": style,
        },
    )
    assert r.status_code == 201
    assert r.json()["stylePrompt"] == style
