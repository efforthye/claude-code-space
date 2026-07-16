import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

from app import stripe_pay
from app.auth import store as users
from app.main import app

client = TestClient(app)


def _sign(payload: bytes, secret: str, ts: float | None = None) -> str:
    t = str(int(ts if ts is not None else time.time()))
    mac = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={t},v1={mac}"


def test_checkout_requires_signin():
    r = client.post("/v1/billing/checkout", json={"planId": "pro"})
    assert r.status_code == 401


def test_checkout_unconfigured_is_clean_400():
    user = users.create_user("buyer@example.com", "Buyer", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    r = client.post(
        "/v1/billing/checkout", json={"planId": "pro"}, headers={"X-Mayo-Session": token}
    )
    # No STRIPE_SECRET_KEY in the test env -> helpful 400, not a 500.
    assert r.status_code == 400
    assert "not configured" in r.json()["detail"]

    bad = client.post(
        "/v1/billing/checkout", json={"planId": "nope"}, headers={"X-Mayo-Session": token}
    )
    assert bad.status_code == 400 and "unknown plan" in bad.json()["detail"]


def test_webhook_signature_and_plan_grant(monkeypatch):
    secret = "whsec_testsecret"
    monkeypatch.setattr(
        stripe_pay,
        "settings",
        type("S", (), {"stripe_webhook_secret": secret})(),
    )
    user = users.create_user("payer@example.com", "Payer", provider="email", password="pw12345678")
    event = {
        "type": "checkout.session.completed",
        "data": {"object": {"client_reference_id": user["id"], "metadata": {"planId": "studio"}}},
    }
    payload = json.dumps(event).encode()

    # bad signature -> 400, no grant
    r = client.post(
        "/v1/billing/stripe-webhook",
        content=payload,
        headers={"Stripe-Signature": "t=1,v1=deadbeef"},
    )
    assert r.status_code == 400
    assert users.users[user["id"]].get("planId", "free") == "free"

    # stale timestamp -> rejected
    stale = client.post(
        "/v1/billing/stripe-webhook",
        content=payload,
        headers={"Stripe-Signature": _sign(payload, secret, ts=time.time() - 3600)},
    )
    assert stale.status_code == 400

    # valid signature -> 200 + plan granted to the referenced user
    ok = client.post(
        "/v1/billing/stripe-webhook",
        content=payload,
        headers={"Stripe-Signature": _sign(payload, secret)},
    )
    assert ok.status_code == 200 and ok.json() == {"received": True}
    assert users.users[user["id"]]["planId"] == "studio"

    # unrelated event types are acknowledged without side effects
    other = json.dumps({"type": "invoice.paid"}).encode()
    ack = client.post(
        "/v1/billing/stripe-webhook",
        content=other,
        headers={"Stripe-Signature": _sign(other, secret)},
    )
    assert ack.status_code == 200
