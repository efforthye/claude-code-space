"""API authentication.

The API is served on a public URL (mayo-api.efforthye.dev), so every /v1/*
endpoint requires a shared API key. Clients present it as `Authorization: Bearer
<key>` (or `X-API-Key: <key>`). The key is compared in constant time and lives
only in the server environment (`MAYO_API_KEY`) — never in the repo.

If `MAYO_API_KEY` is unset the check is a no-op (local dev / tests); `main.py`
logs a loud warning at startup so this is never silently the case in production.
`/health` stays open so uptime checks and the tunnel can probe liveness.

A shared key baked into a public mobile client isn't a per-user secret — it's a
first gate (stops drive-by access, is rotatable). Real per-user auth arrives with
accounts/login later.
"""

from __future__ import annotations

import secrets
from typing import Optional

from fastapi import Header, HTTPException, status

from .config import settings


def require_api_key(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None),
    x_mayo_session: Optional[str] = Header(default=None),
) -> None:
    key = settings.api_key
    if not key:
        return  # not configured — open (dev); main.py warns at startup

    presented: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        presented = authorization[len("bearer ") :].strip()
    elif x_api_key:
        presented = x_api_key.strip()

    if presented and secrets.compare_digest(presented, key):
        return

    # A signed-in user's session is an equally valid credential — this is what
    # lets the public web build (mayo.im) ship WITHOUT the shared key baked into
    # its inspectable JS bundle: web visitors sign in instead (ADR 0011).
    if x_mayo_session:
        from .auth import store as users  # lazy — avoids an import cycle

        if users.user_for_session(x_mayo_session):
            return

    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail="invalid or missing API key",
        headers={"WWW-Authenticate": "Bearer"},
    )
