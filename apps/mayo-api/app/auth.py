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
    """Users + sessions, persisted as one JSON blob (best-effort)."""

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}  # token -> {userId, expiresAt}
        try:
            with open(_PATH) as fh:
                data = json.load(fh)
            self.users = data.get("users", {})
            self.sessions = data.get("sessions", {})
        except Exception:
            pass

    def save(self) -> None:
        try:
            os.makedirs(os.path.dirname(_PATH) or ".", exist_ok=True)
            with open(_PATH, "w") as fh:
                json.dump({"users": self.users, "sessions": self.sessions}, fh)
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
    )


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
