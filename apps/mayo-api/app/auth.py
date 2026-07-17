"""Accounts + sessions — real per-user auth (email/password and Google).

Storage is a small JSON file next to the media dir (same pattern as runtime.py):
fine at this scale, swappable for a DB later without changing the endpoints.
Passwords are hashed with scrypt (stdlib) + per-user salt — never stored raw.
Google sign-in: the app obtains an id_token client-side and POSTs it here; we
verify it against Google's tokeninfo endpoint and check the audience matches the
configured client id(s) (GOOGLE_OAUTH_CLIENT_IDS — names only in the repo).

Sessions are opaque random tokens presented via the `X-Mayo-Session` header
(separate from the shared API key in `Authorization`). See security.py for the
shared-key gate; this layer identifies *which user* is calling.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import time
from typing import Optional

import httpx
from pydantic import BaseModel, Field

# Light email shape check (full RFC validation would need the email-validator dep).
_EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

from .config import settings

_PATH = os.path.join(settings.storage_local_path, ".users.json")

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


class AuthUser(BaseModel):
    id: str
    email: str
    name: str
    provider: str  # "email" | "google"
    createdAt: float
    planId: str = "free"  # entitlement, granted by billing (e.g. Stripe webhook)
    credits: int = 0  # spendable generation credits


class RegisterRequest(BaseModel):
    email: str = Field(pattern=_EMAIL_RE, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(default="", max_length=60)


class LoginRequest(BaseModel):
    email: str = Field(pattern=_EMAIL_RE, max_length=200)
    password: str = Field(max_length=200)


class GoogleLoginRequest(BaseModel):
    idToken: str = Field(min_length=10)


class SessionResult(BaseModel):
    token: str
    user: AuthUser


class _Store:
    """Users + sessions — in-memory dicts written through to SQLite (app/db.py)."""

    def __init__(self) -> None:
        from . import db

        def _from_legacy(raw: dict) -> list[tuple[str, dict]]:
            docs: list[tuple[str, dict]] = []
            for uid, u in raw.get("users", {}).items():
                docs.append((uid, {"_t": "user", **u}))
            for tok, s in raw.get("sessions", {}).items():
                docs.append((tok, {"_t": "session", "token": tok, **s}))
            return docs

        records = db.migrate_legacy_json("auth", _PATH, _from_legacy) or db.load("auth")
        self.users = {r["id"]: {k: v for k, v in r.items() if k != "_t"}
                      for r in records if r.get("_t") == "user"}
        self.sessions = {r["token"]: {"userId": r["userId"], "expiresAt": r["expiresAt"]}
                         for r in records if r.get("_t") == "session"}

    def save(self) -> None:
        from . import db

        try:
            docs: list[tuple[str, dict]] = []
            for uid, u in self.users.items():
                docs.append((uid, {"_t": "user", **u}))
            for tok, s in self.sessions.items():
                docs.append((tok, {"_t": "session", "token": tok, **s}))
            db.replace_kind("auth", docs)
        except Exception:
            pass  # in-memory state still applies

    # --- users ---
    def by_email(self, email: str) -> Optional[dict]:
        e = email.strip().lower()
        return next((u for u in self.users.values() if u["email"] == e), None)

    def create_user(self, email: str, name: str, provider: str, password: str | None) -> dict:
        uid = f"u_{secrets.token_hex(8)}"
        rec: dict = {
            "id": uid,
            "email": email.strip().lower(),
            "name": name.strip() or email.split("@")[0],
            "provider": provider,
            "createdAt": time.time(),
            "credits": 100,  # signup grant — plans/billing top this up
        }
        if password is not None:
            salt = secrets.token_bytes(16)
            rec["salt"] = salt.hex()
            rec["hash"] = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT).hex()
        self.users[uid] = rec
        self.save()
        return rec

    def check_password(self, user: dict, password: str) -> bool:
        salt = bytes.fromhex(user.get("salt", ""))
        expected = user.get("hash", "")
        if not salt or not expected:
            return False  # social-only account — no password set
        digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT).hex()
        return secrets.compare_digest(digest, expected)

    # --- sessions ---
    def create_session(self, user_id: str) -> str:
        token = f"s_{secrets.token_urlsafe(32)}"
        self.sessions[token] = {"userId": user_id, "expiresAt": time.time() + SESSION_TTL_SECONDS}
        self.save()
        return token

    def user_for_session(self, token: str) -> Optional[dict]:
        rec = self.sessions.get(token)
        if not rec:
            return None
        if rec["expiresAt"] < time.time():
            self.sessions.pop(token, None)
            self.save()
            return None
        return self.users.get(rec["userId"])

    def drop_session(self, token: str) -> None:
        if self.sessions.pop(token, None) is not None:
            self.save()

    # --- BYOK: per-user provider keys (values live only in the gitignored store;
    # reads are always masked — the full value is never returned to a client) ---
    def set_byok_keys(self, user_id: str, keys: dict[str, str]) -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        stored: dict[str, str] = dict(user.get("byokKeys", {}))
        for name, value in keys.items():
            value = value.strip()
            if value:
                stored[name] = value
            else:
                stored.pop(name, None)  # empty -> remove the key
        user["byokKeys"] = stored
        self.save()
        return True

    def byok_key(self, user: dict | None, provider: str) -> str:
        return (user or {}).get("byokKeys", {}).get(provider, "")

    def set_youtube_token(self, user_id: str, refresh_token: str) -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        user["youtubeRefreshToken"] = refresh_token
        self.save()
        return True

    def add_credits(self, user_id: str, delta: int) -> Optional[int]:
        """Adjust a user's credit balance (never below 0); returns the new balance."""
        user = self.users.get(user_id)
        if not user:
            return None
        user["credits"] = max(0, int(user.get("credits", 0)) + delta)
        self.save()
        return user["credits"]

    def set_plan(self, user_id: str, plan_id: str) -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        user["planId"] = plan_id
        self.save()
        return True


store = _Store()


def to_public(user: dict) -> AuthUser:
    return AuthUser(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        provider=user["provider"],
        createdAt=user["createdAt"],
        planId=user.get("planId", "free"),
        credits=int(user.get("credits", 0)),
    )


def paid_user_or_none(session_token: str | None) -> Optional[dict]:
    """The session's user if they're on a paid plan, else None."""
    user = store.user_for_session(session_token or "")
    if user and user.get("planId", "free") != "free":
        return user
    return None


# --- Server-driven Google login (works in Expo Go, where in-app OAuth redirects
# hang): the app gets a one-time loginId + Google URL from /google/start, the
# user approves in a real browser, Google redirects to our (already registered)
# callback which mints a session under the loginId, and the app polls
# /google/result until it's ready. Same pattern as the YouTube connect flow.
_LOGIN_TTL = 600
_login_pending: dict[str, dict] = {}  # loginId -> {state, expiresAt, result}


def start_google_login() -> tuple[str, str]:
    """Returns (loginId, google_auth_url). Raises ValueError if unconfigured."""
    from urllib.parse import urlencode

    if not (settings.youtube_client_id and settings.youtube_client_secret):
        raise ValueError("Google sign-in is not configured on this server")
    login_id = secrets.token_urlsafe(16)
    state = "login." + secrets.token_urlsafe(24)
    _login_pending[login_id] = {"state": state, "expiresAt": time.time() + _LOGIN_TTL, "result": None}
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(
        {
            "client_id": settings.youtube_client_id,
            "redirect_uri": settings.youtube_redirect_uri,  # already registered
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    return login_id, url


def login_id_for_state(state: str) -> Optional[str]:
    now = time.time()
    for login_id, rec in _login_pending.items():
        if rec["state"] == state and rec["expiresAt"] > now:
            return login_id
    return None


async def complete_google_login(login_id: str, code: str) -> None:
    """Exchange the code, verify the id_token, sign the user in under loginId."""
    from . import youtube

    tokens = await youtube.exchange_code(code)
    id_token = tokens.get("id_token", "")
    claims = await verify_google_id_token(id_token)
    user = store.by_email(claims["email"])
    if not user:
        user = store.create_user(claims["email"], claims.get("name", ""), provider="google", password=None)
    rec = _login_pending.get(login_id)
    if rec:
        rec["result"] = {"token": store.create_session(user["id"]), "user": to_public(user).model_dump()}


def take_login_result(login_id: str) -> Optional[dict]:
    """One-shot: the session once ready, else None (pending/expired)."""
    rec = _login_pending.get(login_id)
    if not rec or rec["expiresAt"] < time.time():
        _login_pending.pop(login_id, None)
        return None
    if rec["result"] is None:
        return None
    return _login_pending.pop(login_id)["result"]


async def verify_google_id_token(id_token: str) -> dict:
    """Validate a Google id_token via the tokeninfo endpoint; returns its claims.

    Raises ValueError with a user-facing reason on any failure. The token's `aud`
    must be one of the configured client ids (GOOGLE_OAUTH_CLIENT_IDS).
    """
    allowed = [c for c in settings.google_oauth_client_ids if c]
    if not allowed:
        raise ValueError("Google sign-in is not configured on this server")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token}
        )
    if resp.status_code != 200:
        raise ValueError("invalid Google token")
    claims = resp.json()
    if claims.get("aud") not in allowed:
        raise ValueError("Google token issued for a different app")
    if claims.get("email_verified") not in (True, "true"):
        raise ValueError("Google account email is not verified")
    if not claims.get("email"):
        raise ValueError("Google token has no email")
    return claims
