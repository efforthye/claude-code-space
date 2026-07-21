"""Stripe card payments (web/mayo.im) — Checkout Sessions + webhook, plain REST.

Stripe's API is form-encoded HTTPS with a Bearer secret key, and webhook
signatures are HMAC-SHA256 — both fine with httpx + stdlib, so no SDK. Keys
(STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*) come from the host
env — names only in the repo. Docs: https://docs.stripe.com/api/checkout/sessions
and https://docs.stripe.com/webhooks#verify-manually. See ADR 0012.

Mobile-store note: digital goods bought *inside the iOS/Android app* must use
in-app purchase per store policy — Stripe here is the **web** path.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time

import httpx

from .config import settings

_API = "https://api.stripe.com/v1"

# Tolerated clock skew for webhook timestamps (Stripe recommends 5 minutes).
WEBHOOK_TOLERANCE_SECONDS = 300


def price_for_plan(plan_id: str) -> str:
    return {"pro": settings.stripe_price_pro, "studio": settings.stripe_price_studio}.get(
        plan_id, ""
    )


def price_for_pack(pack_id: str) -> str:
    return {
        "pack100": settings.stripe_price_pack_100,
        "pack300": settings.stripe_price_pack_300,
        "pack1000": settings.stripe_price_pack_1000,
    }.get(pack_id, "")


def is_configured() -> bool:
    return bool(settings.stripe_secret_key)


async def create_checkout_session(plan_id: str, user_id: str) -> str:
    """Create a subscription Checkout Session; returns the hosted payment URL.

    `client_reference_id` carries our user id so the webhook can grant the plan
    to the right account. Raises ValueError with a user-facing reason.
    """
    if not is_configured():
        raise ValueError("card payments are not configured on this server")
    price = price_for_plan(plan_id)
    if not price:
        raise ValueError(f"no Stripe price configured for plan '{plan_id}'")

    form = {
        "mode": "subscription",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        "success_url": settings.checkout_success_url,
        "cancel_url": settings.checkout_cancel_url,
        "client_reference_id": user_id,
        "metadata[planId]": plan_id,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_API}/checkout/sessions",
            data=form,
            headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
        )
    if resp.status_code != 200:
        raise ValueError("could not start the card checkout — try again")
    url = resp.json().get("url")
    if not url:
        raise ValueError("Stripe returned no checkout URL")
    return url


def verify_webhook_signature(payload: bytes, sig_header: str, *, now: float | None = None) -> bool:
    """Manually verify Stripe's `Stripe-Signature: t=...,v1=...` header."""
    secret = settings.stripe_webhook_secret
    if not secret or not sig_header:
        return False
    parts = dict(
        p.split("=", 1) for p in sig_header.split(",") if "=" in p
    )
    timestamp = parts.get("t", "")
    signature = parts.get("v1", "")
    if not timestamp or not signature:
        return False
    try:
        ts = float(timestamp)
    except ValueError:
        return False
    if abs((now if now is not None else time.time()) - ts) > WEBHOOK_TOLERANCE_SECONDS:
        return False
    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def create_pack_checkout(pack_id: str, credits: int, user_id: str) -> str:
    """One-time (mode=payment) Checkout Session for a credit pack — no
    subscription involved; the webhook grants the credits (ADR 0017 v2)."""
    if not is_configured():
        raise ValueError("card payments are not configured on this server")
    price = price_for_pack(pack_id)
    if not price:
        raise ValueError(f"no Stripe price configured for pack '{pack_id}'")

    form = {
        "mode": "payment",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        "success_url": settings.checkout_success_url,
        "cancel_url": settings.checkout_cancel_url,
        "client_reference_id": user_id,
        "metadata[packId]": pack_id,
        "metadata[credits]": str(credits),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_API}/checkout/sessions",
            data=form,
            headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
        )
    if resp.status_code != 200:
        raise ValueError("could not start the card checkout — try again")
    url = resp.json().get("url")
    if not url:
        raise ValueError("Stripe returned no checkout URL")
    return url


def parse_completed_checkout(payload: bytes) -> dict | None:
    """If the event is a completed checkout, return what to grant:
    {"userId", "planId"} for a subscription or {"userId", "credits"} for a
    credit pack (metadata decides which)."""
    try:
        event = json.loads(payload)
    except ValueError:
        return None
    if event.get("type") != "checkout.session.completed":
        return None
    session = event.get("data", {}).get("object", {})
    user_id = session.get("client_reference_id") or ""
    meta = session.get("metadata") or {}
    if not user_id:
        return None
    if meta.get("planId"):
        return {"userId": user_id, "planId": meta["planId"]}
    if meta.get("packId"):
        try:
            credits = int(meta.get("credits", "0"))
        except ValueError:
            return None
        if credits > 0:
            return {"userId": user_id, "credits": credits}
    return None
