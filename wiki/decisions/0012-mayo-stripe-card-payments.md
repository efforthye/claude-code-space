---
title: "ADR 0012 — mayo real payments: Stripe Checkout (web) first, IAP later"
type: decision
status: accepted
tags: [mayo, billing, stripe, payments]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0012 — mayo real payments: Stripe Checkout (web) first, IAP later

## Context
Plans (pro/studio) were purchasable only through a **mock** payments provider in
the app. The owner asked how to attach a real payment system. Platform rules split
the answer: digital goods bought *inside* the iOS/Android app must use the store's
**in-app purchase** (which Expo Go cannot do — needs a dev build), while the
**web** ([[mayo-web-target]]) can charge cards directly with no store fee.

## Decision
Ship the web/card path first with **Stripe Checkout**, keeping the IAP seam for a
later dev build:
- **`app/stripe_pay.py`** — plain REST (httpx + stdlib): Stripe's API is
  form-encoded HTTPS and webhook signatures are HMAC-SHA256, so no SDK.
  - `create_checkout_session(plan, user)` → `POST /v1/checkout/sessions`
    (mode=subscription, price id per plan, `client_reference_id` = our user id) →
    returns the hosted payment URL.
  - `verify_webhook_signature` — manual `Stripe-Signature` check (t/v1 HMAC,
    5-minute tolerance), per Stripe's verify-manually docs.
- **Endpoints** — `POST /v1/billing/checkout` (requires a signed-in user, ADR
  [[0011-mayo-accounts-sns-login]]; 400 with a clear message when Stripe isn't
  configured) and `POST /v1/billing/stripe-webhook` mounted **without** the
  shared-key guard (Stripe can't send our key — the verified signature is the
  auth). On `checkout.session.completed` the plan is granted to the user
  (`users.set_plan`), which `GET /v1/auth/me` then reports (`AuthUser.planId`).
- **App** — the Plan screen gains "카드로 결제 (웹)": not signed in → login modal;
  signed in → opens the Stripe-hosted page (expo-web-browser). The mock IAP flow
  stays as-is for the future dev build.
- Config names only in the repo: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PRO/STUDIO`, `MAYO_CHECKOUT_SUCCESS/CANCEL_URL`.

## Consequences
- ✅ A real, end-to-end purchase path exists (create session → pay on Stripe →
  webhook grants plan → `me` reflects it), dormant until Stripe keys are set.
- ✅ Tested: 401 without sign-in, clean 400 unconfigured/unknown plan, webhook
  bad-signature + stale-timestamp rejection, plan grant on valid signature,
  unrelated events acknowledged (pytest 49/49).
- ⚠️ To go live: create the Stripe products/prices, set the env keys, and point a
  Stripe webhook at `https://mayo-api.efforthye.dev/v1/billing/stripe-webhook`.
- ⚠️ Mobile IAP still requires a dev build + store products; `/v1/billing/validate`
  remains the seam for real receipt validation.
- 🔜 Follow-ups: subscription lifecycle (cancel/renew webhooks → downgrade), a
  customer portal link, and entitlement enforcement server-side (storage caps by
  the *account's* plan rather than the app-side mock).

## Related
- Accounts: [[0011-mayo-accounts-sns-login]] · Web: [[mayo-web-target]] ·
  Service: [[mayo]] · Backend: [[0005-mayo-backend-fastapi]]
