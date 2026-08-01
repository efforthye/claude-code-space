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
    provider: str  # original sign-up provider: "email" | "google" | "github" | "apple"
    createdAt: float
    planId: str = "free"  # entitlement, granted by billing (e.g. Stripe webhook)
    credits: int = 0  # spendable generation credits
    # Every login method connected to this account (original + linked SNS).
    providers: list[str] = []
    # Paid-capable: a paid plan OR any purchased credit pack — unlocks premium
    # features (Claude director, external generation). ADR 0017 v2.
    premium: bool = False


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

    def by_identity(self, provider: str, email: str) -> Optional[dict]:
        """The account a linked SNS identity belongs to (provider+email match).
        Lets one account carry Google/GitHub/Apple logins with DIFFERENT emails."""
        e = email.strip().lower()
        for u in self.users.values():
            for ident in u.get("identities", []):
                if ident.get("provider") == provider and ident.get("email") == e:
                    return u
        return None

    def add_identity(self, user_id: str, provider: str, email: str) -> bool:
        """Record a login method on an account (idempotent). A given
        provider+email pair can belong to only one account."""
        user = self.users.get(user_id)
        if not user:
            return False
        owner = self.by_identity(provider, email)
        if owner and owner["id"] != user_id:
            return False  # already linked to a different account
        e = email.strip().lower()
        idents = list(user.get("identities", []))
        if not any(i.get("provider") == provider and i.get("email") == e for i in idents):
            idents.append({"provider": provider, "email": e})
            user["identities"] = idents
            self.save()
        return True

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
        from . import ledger

        ledger.record("signup", uid, email=rec["email"], product=provider)
        return rec

    def set_password(self, user_id: str, password: str) -> bool:
        """Set/replace the account password (also gives social-only accounts an
        email login) and revoke every existing session for safety."""
        user = self.users.get(user_id)
        if not user:
            return False
        salt = secrets.token_bytes(16)
        user["salt"] = salt.hex()
        user["hash"] = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT).hex()
        for tok in [t for t, s in self.sessions.items() if s["userId"] == user_id]:
            self.sessions.pop(tok, None)
        self.save()
        return True

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

    def add_purchased_credits(self, user_id: str, amount: int) -> Optional[int]:
        """Grant PURCHASED credits (a paid pack): tops up the balance and bumps
        the lifetime `purchasedCredits` marker that makes the account
        premium-capable without a subscription (ADR 0017 v2)."""
        user = self.users.get(user_id)
        if not user or amount <= 0:
            return None
        user["credits"] = int(user.get("credits", 0)) + amount
        user["purchasedCredits"] = int(user.get("purchasedCredits", 0)) + amount
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
    providers = [user["provider"]] + [
        i.get("provider", "") for i in user.get("identities", [])
    ]
    seen: list[str] = []
    for p in providers:
        if p and p not in seen:
            seen.append(p)
    return AuthUser(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        provider=user["provider"],
        createdAt=user["createdAt"],
        planId=user.get("planId", "free"),
        credits=int(user.get("credits", 0)),
        providers=seen,
        premium=user.get("planId", "free") != "free"
        or int(user.get("purchasedCredits", 0)) > 0,
    )


def is_admin_user(user: dict | None) -> bool:
    allowed = [e.strip().lower() for e in settings.admin_emails if e.strip()]
    return bool(user) and user.get("email", "").lower() in allowed


def paid_user_or_none(session_token: str | None) -> Optional[dict]:
    """The session's user if they're on a paid plan, else None."""
    user = store.user_for_session(session_token or "")
    if user and user.get("planId", "free") != "free":
        return user
    return None


def premium_user_or_none(session_token: str | None) -> Optional[dict]:
    """Who may use PAID features: a paying plan, a purchased credit pack (pay-
    as-you-go, ADR 0017 v2), or an admin account (the owner tests everything
    without buying their own product). Free users: None."""
    user = store.user_for_session(session_token or "")
    if user and (
        user.get("planId", "free") != "free"
        or int(user.get("purchasedCredits", 0)) > 0
        or is_admin_user(user)
    ):
        return user
    return None


# --- Password reset: a 6-digit code is emailed to the account address; entering
# it (with a new password) rotates the password and revokes old sessions. The
# code store is in-memory (10-min TTL) — a restart just voids pending codes. ---
_RESET_TTL = 600
_RESET_MAX_ATTEMPTS = 5
_reset_pending: dict[str, dict] = {}  # email -> {code, expiresAt, attempts}


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def _send_mail(to_email: str, subject: str, body: str) -> None:
    """Blocking SMTP send (call via asyncio.to_thread). STARTTLS on 587-style
    ports; implicit TLS on 465."""
    import smtplib
    from email.mime.text import MIMEText

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    if settings.smtp_port == 465:
        server: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
        server.starttls()
    try:
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to_email], msg.as_string())
    finally:
        server.quit()


async def start_password_reset(email: str) -> None:
    """Email a reset code to the address IF an account exists. Always succeeds
    from the caller's view (no account enumeration). Raises ValueError when the
    server has no SMTP configured — the router turns that into a 501."""
    import asyncio

    if not smtp_configured():
        raise ValueError("password reset mail is not configured on this server")
    e = email.strip().lower()
    user = store.by_email(e)
    if not user:
        return  # pretend-send: don't reveal whether the account exists
    code = f"{secrets.randbelow(1_000_000):06d}"
    _reset_pending[e] = {
        "code": code,
        "expiresAt": time.time() + _RESET_TTL,
        "attempts": 0,
    }
    body = (
        f"mayo 비밀번호 재설정 코드: {code}\n\n"
        "앱의 재설정 화면에 이 코드를 입력해주세요. 10분 동안 유효합니다.\n"
        "요청한 적이 없다면 이 메일은 무시하셔도 됩니다.\n\n"
        f"Your mayo password reset code is {code}. It expires in 10 minutes."
    )
    await asyncio.to_thread(_send_mail, e, "mayo 비밀번호 재설정 코드", body)


def complete_password_reset(email: str, code: str, new_password: str) -> Optional[dict]:
    """Verify the emailed code and rotate the password; returns the user on
    success, None on a wrong/expired code (attempts are capped)."""
    e = email.strip().lower()
    rec = _reset_pending.get(e)
    if not rec or rec["expiresAt"] < time.time():
        _reset_pending.pop(e, None)
        return None
    rec["attempts"] += 1
    if rec["attempts"] > _RESET_MAX_ATTEMPTS or not secrets.compare_digest(rec["code"], code.strip()):
        if rec["attempts"] > _RESET_MAX_ATTEMPTS:
            _reset_pending.pop(e, None)
        return None
    user = store.by_email(e)
    if not user:
        return None
    _reset_pending.pop(e, None)
    store.set_password(user["id"], new_password)
    return user


# --- Server-driven Google login (works in Expo Go, where in-app OAuth redirects
# hang): the app gets a one-time loginId + Google URL from /google/start, the
# user approves in a real browser, Google redirects to our (already registered)
# callback which mints a session under the loginId, and the app polls
# /google/result until it's ready. Same pattern as the YouTube connect flow.
_LOGIN_TTL = 600
_login_pending: dict[str, dict] = {}  # loginId -> {state, expiresAt, result}


def start_google_login(link_user_id: str | None = None) -> tuple[str, str]:
    """Returns (loginId, google_auth_url). Raises ValueError if unconfigured.
    With link_user_id set, completion LINKS the Google identity to that account
    instead of signing in (multi-SNS on one account)."""
    from urllib.parse import urlencode

    if not (settings.youtube_client_id and settings.youtube_client_secret):
        raise ValueError("Google sign-in is not configured on this server")
    login_id = secrets.token_urlsafe(16)
    state = "login." + secrets.token_urlsafe(24)
    _login_pending[login_id] = {
        "state": state,
        "expiresAt": time.time() + _LOGIN_TTL,
        "result": None,
        "linkUserId": link_user_id,
    }
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
    """Exchange the code, verify the id_token, sign the user in under loginId —
    or, for a link request, attach the Google identity to the linking account."""
    from . import youtube

    tokens = await youtube.exchange_code(code)
    id_token = tokens.get("id_token", "")
    claims = await verify_google_id_token(id_token)
    email = claims["email"]
    rec = _login_pending.get(login_id)
    link_uid = (rec or {}).get("linkUserId")
    if link_uid:
        ok = store.add_identity(link_uid, "google", email)
        if rec:
            rec["result"] = {"linked": "google" if ok else None}
        return
    user = store.by_identity("google", email) or store.by_email(email)
    if not user:
        user = store.create_user(email, claims.get("name", ""), provider="google", password=None)
    store.add_identity(user["id"], "google", email)
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


# --- GitHub login (same server-driven start/poll pattern as Google, but with a
# dedicated OAuth app + callback: /v1/auth/github/callback) ---


def start_github_login(link_user_id: str | None = None) -> tuple[str, str]:
    """Returns (loginId, github_authorize_url). Raises ValueError if unconfigured.
    With link_user_id set, completion links the identity instead of signing in."""
    from urllib.parse import urlencode

    if not (settings.github_oauth_client_id and settings.github_oauth_client_secret):
        raise ValueError("GitHub sign-in is not configured on this server")
    login_id = secrets.token_urlsafe(16)
    state = "ghlogin." + secrets.token_urlsafe(24)
    _login_pending[login_id] = {
        "state": state,
        "expiresAt": time.time() + _LOGIN_TTL,
        "result": None,
        "linkUserId": link_user_id,
    }
    url = "https://github.com/login/oauth/authorize?" + urlencode(
        {
            "client_id": settings.github_oauth_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "read:user user:email",
            "state": state,
        }
    )
    return login_id, url


async def complete_github_login(login_id: str, code: str) -> None:
    """Exchange the code, fetch the GitHub profile, sign the user in under loginId."""
    async with httpx.AsyncClient(timeout=20) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.github_oauth_client_id,
                "client_secret": settings.github_oauth_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        access = token_resp.json().get("access_token", "")
        if not access:
            raise ValueError("GitHub did not return an access token")
        gh_headers = {"Authorization": f"Bearer {access}", "Accept": "application/vnd.github+json"}
        profile = (await client.get("https://api.github.com/user", headers=gh_headers)).json()
        email = profile.get("email") or ""
        if not email:
            emails = (await client.get("https://api.github.com/user/emails", headers=gh_headers)).json()
            primary = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                next((e for e in emails if e.get("verified")), None),
            )
            email = (primary or {}).get("email", "")
    if not email:
        raise ValueError("GitHub account has no verified email")
    rec = _login_pending.get(login_id)
    link_uid = (rec or {}).get("linkUserId")
    if link_uid:
        ok = store.add_identity(link_uid, "github", email)
        if rec:
            rec["result"] = {"linked": "github" if ok else None}
        return
    user = store.by_identity("github", email) or store.by_email(email)
    if not user:
        name = profile.get("name") or profile.get("login") or ""
        user = store.create_user(email, name, provider="github", password=None)
    store.add_identity(user["id"], "github", email)
    if rec:
        rec["result"] = {"token": store.create_session(user["id"]), "user": to_public(user).model_dump()}


# --- Apple login: the app (expo-apple-authentication) obtains an identityToken
# JWT on-device; we verify its signature against Apple's JWKS and its audience
# against APPLE_OAUTH_AUDIENCES. ---


async def verify_apple_id_token(id_token: str) -> dict:
    """Validate an Apple identityToken; returns its claims.

    Needs PyJWT[crypto] on the host (lazy import so a missing wheel can never
    take the API down). Raises ValueError with a user-facing reason on failure.
    """
    import asyncio

    try:
        import jwt
        from jwt import PyJWKClient
    except ImportError as exc:  # pragma: no cover - dep present in CI
        raise ValueError("Apple sign-in needs PyJWT[crypto] installed on the server") from exc

    allowed = [a for a in settings.apple_oauth_audiences if a]
    if not allowed:
        raise ValueError("Apple sign-in is not configured on this server")

    def _verify() -> dict:
        key = PyJWKClient("https://appleid.apple.com/auth/keys").get_signing_key_from_jwt(id_token)
        return jwt.decode(
            id_token,
            key.key,
            algorithms=["RS256"],
            audience=allowed,
            issuer="https://appleid.apple.com",
        )

    try:
        claims = await asyncio.to_thread(_verify)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("invalid Apple token") from exc
    if not claims.get("email"):
        raise ValueError("Apple token has no email")
    return claims


async def apple_login(id_token: str, name: str = "", link_user: dict | None = None) -> dict:
    """Verify the token and mint a session; returns {token, user} like Google.
    With link_user set (caller already signed in), the Apple identity is linked
    to that account instead of creating/signing into another one."""
    claims = await verify_apple_id_token(id_token)
    email = claims["email"]
    if link_user is not None:
        if not store.add_identity(link_user["id"], "apple", email):
            raise ValueError("this Apple account is already linked to another user")
        return {"token": None, "user": to_public(store.users[link_user["id"]]).model_dump()}
    user = store.by_identity("apple", email) or store.by_email(email)
    if not user:
        # Apple only shares the name on the FIRST authorization — persist it now.
        user = store.create_user(email, name, provider="apple", password=None)
    store.add_identity(user["id"], "apple", email)
    return {"token": store.create_session(user["id"]), "user": to_public(user).model_dump()}


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
