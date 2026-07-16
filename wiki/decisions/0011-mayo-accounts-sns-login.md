---
title: "ADR 0011 — mayo accounts + SNS login (email/password, Google)"
type: decision
status: accepted
tags: [mayo, auth, accounts, oauth, google]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0011 — mayo accounts + SNS login (email/password, Google)

## Context
Everything social in [[mayo]] (likes, follows, the "liked" collection) was
device-local (AsyncStorage), and the API's only auth was the **shared** bearer key
([[0008-mayo-ai-director-scenario-planner]] records that hardening). The owner asked
for real login with SNS providers ("구글, ~~~~ 다 가능하게"). A public **mayo.im** web
build also *requires* per-user auth — the shared key can't be shipped in a public
web bundle ([[mayo-web-target]]).

## Decision
A small first-party auth layer in mayo-api, provider-extensible:
- **`app/auth.py`** — users + sessions persisted to `media/.users.json` (same
  pattern as `runtime.py`; the media dir is gitignored, so user data never enters
  the repo). Passwords hashed with **scrypt** (stdlib) + per-user salt. Sessions are
  opaque 30-day tokens.
- **Wire protocol** — the session token travels in **`X-Mayo-Session`**, separate
  from the shared API key in `Authorization` (both are sent; the key gates the API,
  the session identifies the user).
- **Endpoints** (`/v1/auth`): `register`, `login`, `google`, `me`, `logout`.
- **Google sign-in** — the app obtains an **id_token** client-side
  (`expo-auth-session/providers/google`; button appears only when
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set) and POSTs it to `/v1/auth/google`; the
  server verifies it against Google's `tokeninfo` endpoint and checks `aud` against
  `GOOGLE_OAUTH_CLIENT_IDS`. First Google login auto-creates the account (keyed by
  email, so email+Google merge onto one user).
- **App** — `AuthProvider` (persists the token, restores + re-validates via `me` on
  launch), a login/register modal (`/login`), and a profile/sign-in card at the top
  of Account. All strings en+ko.

## Alternatives considered
- **Managed auth (Firebase/Auth0/Supabase)** — rejected for now: an external
  dependency + dashboard for what is currently one JSON file; the endpoints are the
  seam, so swapping the store for a managed provider later doesn't change the app.
- **JWTs** — unnecessary; opaque server-side sessions are simpler and revocable.

## Consequences
- ✅ Real per-user identity, working now with email/password; Google works as soon
  as client ids are configured (server + app env).
- ✅ Web-ready: this is the auth a public mayo.im needs instead of the shared key.
- ✅ Tested: register/login/me/logout roundtrip, duplicate email 409, wrong password
  401, validation 422s, Google unconfigured 401, Google `aud` mismatch.
- ⚠️ Likes/follows/favorites are still device-local — migrating them to be
  account-scoped (server-side, keyed by user) is the follow-up.
- ⚠️ Apple sign-in (App Store requirement if social login ships on iOS) and Kakao
  are future providers; the `provider` field + endpoint shape already accommodate them.
- 🔜 Follow-ups: account-scoped social data; per-user BYOK keys; password reset;
  rate-limiting on the auth endpoints.

## Related
- Service: [[mayo]] · Web: [[mayo-web-target]] · API/backend:
  [[0005-mayo-backend-fastapi]] · Shared-key gate: [[0008-mayo-ai-director-scenario-planner]]
