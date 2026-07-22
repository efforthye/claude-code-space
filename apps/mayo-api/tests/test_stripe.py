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

    # plan grant also lands the first month's subscription credits (ADR 0017 v2)
    from app.catalog import PLANS

    studio_credits = next(p.monthlyCredits for p in PLANS if p.id == "studio")
    assert users.users[user["id"]]["credits"] >= studio_credits

    # unrelated event types are acknowledged without side effects
    other = json.dumps({"type": "invoice.paid"}).encode()
    ack = client.post(
        "/v1/billing/stripe-webhook",
        content=other,
        headers={"Stripe-Signature": _sign(other, secret)},
    )
    assert ack.status_code == 200


def test_credit_pack_listing_checkout_and_webhook_grant(monkeypatch):
    """Packs are listed, need exactly-one target at checkout, and a completed
    pack checkout grants credits + premium capability WITHOUT a subscription."""
    from app.auth import premium_user_or_none, to_public

    packs = client.get("/v1/billing/packs")
    assert packs.status_code == 200
    ids = [p["id"] for p in packs.json()]
    assert ids == ["pack100", "pack300", "pack1000"]
    assert all(p["credits"] > 0 and p["usd"] > 0 for p in packs.json())

    user = users.create_user("packer@example.com", "Packer", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    h = {"X-Mayo-Session": token}

    # exactly one of planId/packId
    assert client.post("/v1/billing/checkout", json={}, headers=h).status_code == 400
    assert (
        client.post(
            "/v1/billing/checkout", json={"planId": "pro", "packId": "pack100"}, headers=h
        ).status_code
        == 400
    )
    bad = client.post("/v1/billing/checkout", json={"packId": "nope"}, headers=h)
    assert bad.status_code == 400 and "unknown pack" in bad.json()["detail"]
    # unconfigured Stripe -> clean 400
    r = client.post("/v1/billing/checkout", json={"packId": "pack100"}, headers=h)
    assert r.status_code == 400 and "not configured" in r.json()["detail"]

    # webhook: completed pack checkout grants credits, no plan change,
    # and the account becomes premium-capable (pay-as-you-go).
    secret = "whsec_testsecret"
    monkeypatch.setattr(
        stripe_pay, "settings", type("S", (), {"stripe_webhook_secret": secret})()
    )
    before = int(users.users[user["id"]].get("credits", 0))
    assert premium_user_or_none(token) is None
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": user["id"],
                "metadata": {"packId": "pack300", "credits": "300"},
            }
        },
    }
    payload = json.dumps(event).encode()
    ok = client.post(
        "/v1/billing/stripe-webhook",
        content=payload,
        headers={"Stripe-Signature": _sign(payload, secret)},
    )
    assert ok.status_code == 200
    rec = users.users[user["id"]]
    assert rec["credits"] == before + 300
    assert rec["planId" if "planId" in rec else "provider"] != "pro"  # no plan granted
    assert rec.get("purchasedCredits") == 300
    assert premium_user_or_none(token) is not None  # pack unlocks premium features
    assert to_public(rec).premium is True


def test_appstore_receipt_validation_grants(monkeypatch):
    """Real IAP path: Apple-approved receipts grant plans/credits; rejected or
    mismatched receipts grant nothing."""
    from app.routers import billing as billing_router

    monkeypatch.setattr(
        billing_router, "settings", type("S", (), {"apple_shared_secret": "shhh"})()
    )
    user = users.create_user("iap@example.com", "Iap", provider="email", password="pw12345678")
    token = users.create_session(user["id"])
    h = {"X-Mayo-Session": token}

    async def apple_ok(receipt):
        return {
            "status": 0,
            "latest_receipt_info": [{"product_id": "im.mayo.pro.monthly"}],
            "receipt": {"in_app": [{"product_id": "im.mayo.pack300"}]},
        }

    monkeypatch.setattr(billing_router, "_apple_verify", apple_ok)

    # subscription -> plan + first month's credits
    r = client.post(
        "/v1/billing/validate",
        json={"productId": "im.mayo.pro.monthly", "platform": "appstore", "receipt": "b64"},
        headers=h,
    )
    assert r.status_code == 200 and r.json() == {"entitled": True, "planId": "pro"}
    assert users.users[user["id"]]["planId"] == "pro"
    assert users.users[user["id"]]["credits"] >= 700

    # consumable pack -> purchased credits (premium marker)
    before = users.users[user["id"]]["credits"]
    r = client.post(
        "/v1/billing/validate",
        json={"productId": "im.mayo.pack300", "platform": "appstore", "receipt": "b64"},
        headers=h,
    )
    assert r.status_code == 200 and r.json()["entitled"] is True
    assert users.users[user["id"]]["credits"] == before + 300
    assert users.users[user["id"]]["purchasedCredits"] == 300

    # product not present in the receipt -> 400
    r = client.post(
        "/v1/billing/validate",
        json={"productId": "im.mayo.pack100", "platform": "appstore", "receipt": "b64"},
        headers=h,
    )
    assert r.status_code == 400

    # Apple says no -> 400, nothing granted
    async def apple_no(receipt):
        return {"status": 21003}

    monkeypatch.setattr(billing_router, "_apple_verify", apple_no)
    r = client.post(
        "/v1/billing/validate",
        json={"productId": "im.mayo.pro.monthly", "platform": "appstore", "receipt": "bad"},
        headers=h,
    )
    assert r.status_code == 400

    # signed-out -> 401; missing receipt -> 400
    monkeypatch.setattr(billing_router, "_apple_verify", apple_ok)
    r = client.post(
        "/v1/billing/validate",
        json={"productId": "im.mayo.pro.monthly", "platform": "appstore", "receipt": "b64"},
    )
    assert r.status_code == 401
    r = client.post(
        "/v1/billing/validate",
        json={"productId": "im.mayo.pro.monthly", "platform": "appstore"},
        headers=h,
    )
    assert r.status_code == 400
