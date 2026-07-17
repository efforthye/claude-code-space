"""YouTube publish — real uploads via the YouTube Data API v3 (plain REST).

Per-user OAuth2: the app opens our /connect URL, the user grants
`youtube.upload` on Google's page, and the callback stores their refresh token
on their account (gitignored user store — never the repo). Publishing then runs
a resumable upload with a freshly refreshed access token.

Docs: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
Auth: https://developers.google.com/identity/protocols/oauth2/web-server
"""

from __future__ import annotations

import secrets
import time
from urllib.parse import urlencode

import httpx

from .config import settings

_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN = "https://oauth2.googleapis.com/token"
_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos"
_SCOPE = "https://www.googleapis.com/auth/youtube.upload"

# One-time OAuth `state` values -> user id (10-minute TTL). Keeps the session
# token out of Google's redirect URL.
_pending: dict[str, tuple[str, float]] = {}


def is_configured() -> bool:
    return bool(settings.youtube_client_id and settings.youtube_client_secret)


def start_connect(user_id: str) -> str:
    """Return the Google consent URL for this user."""
    if not is_configured():
        raise ValueError("YouTube publish is not configured on this server")
    state = secrets.token_urlsafe(24)
    _pending[state] = (user_id, time.time() + 600)
    return _AUTH + "?" + urlencode(
        {
            "client_id": settings.youtube_client_id,
            "redirect_uri": settings.youtube_redirect_uri,
            "response_type": "code",
            "scope": _SCOPE,
            "access_type": "offline",
            "prompt": "consent",  # ensures a refresh_token is issued
            "state": state,
        }
    )


def consume_state(state: str) -> str | None:
    """Resolve a callback state to its user id (one-time, TTL-checked)."""
    rec = _pending.pop(state, None)
    if not rec or rec[1] < time.time():
        return None
    return rec[0]


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _TOKEN,
            data={
                "code": code,
                "client_id": settings.youtube_client_id,
                "client_secret": settings.youtube_client_secret,
                "redirect_uri": settings.youtube_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise ValueError("Google token exchange failed")
    return resp.json()


async def refresh_access_token(refresh_token: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _TOKEN,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.youtube_client_id,
                "client_secret": settings.youtube_client_secret,
                "grant_type": "refresh_token",
            },
        )
    if resp.status_code != 200:
        raise ValueError("YouTube token refresh failed — reconnect your account")
    token = resp.json().get("access_token")
    if not token:
        raise ValueError("YouTube token refresh returned no access token")
    return token


async def upload_video(
    refresh_token: str,
    data: bytes,
    title: str,
    description: str,
    visibility: str,
    tags: list[str] | None = None,
) -> str:
    """Resumable upload; returns the new YouTube video id."""
    access = await refresh_access_token(refresh_token)
    snippet: dict = {"title": title[:100] or "mayo film", "description": description[:4900]}
    if tags:
        # YouTube caps tags at ~500 chars total; keep the first 30 clean ones.
        snippet["tags"] = [t.strip()[:75] for t in tags if t.strip()][:30]
    meta = {
        "snippet": snippet,
        "status": {
            "privacyStatus": visibility if visibility in ("private", "unlisted", "public") else "private",
            "selfDeclaredMadeForKids": False,
        },
    }
    async with httpx.AsyncClient(timeout=600) as client:
        start = await client.post(
            f"{_UPLOAD}?uploadType=resumable&part=snippet,status",
            json=meta,
            headers={
                "Authorization": f"Bearer {access}",
                "X-Upload-Content-Type": "video/mp4",
                "X-Upload-Content-Length": str(len(data)),
            },
        )
        if start.status_code != 200 or "location" not in start.headers:
            raise ValueError("YouTube rejected the upload request")
        put = await client.put(
            start.headers["location"],
            content=data,
            headers={"Content-Type": "video/mp4"},
        )
        if put.status_code not in (200, 201):
            raise ValueError("YouTube upload failed")
        video_id = put.json().get("id")
    if not video_id:
        raise ValueError("YouTube returned no video id")
    return video_id
