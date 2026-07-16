"""YouTube publish endpoints — per-user OAuth connect + status.

`/connect` and `/status` sit behind the shared API key like the rest of /v1/*.
`/callback` is Google's browser redirect, which cannot carry our key — it is
mounted WITHOUT the guard (main.py); the one-time `state` token is its auth.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .. import youtube
from ..auth import store as users

router = APIRouter(prefix="/v1/publish/youtube", tags=["publish"])
callback_router = APIRouter(prefix="/v1/publish/youtube", tags=["publish"])


class ConnectResult(BaseModel):
    url: str  # Google consent page to open in a browser


class YoutubeStatus(BaseModel):
    configured: bool  # server has a client id/secret
    connected: bool  # this user granted upload access


def _require_user(token: str | None) -> dict:
    user = users.user_for_session(token or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in first")
    return user


@router.get("/status", response_model=YoutubeStatus)
async def yt_status(x_mayo_session: Optional[str] = Header(default=None)) -> YoutubeStatus:
    user = users.user_for_session(x_mayo_session or "")
    return YoutubeStatus(
        configured=youtube.is_configured(),
        connected=bool(user and user.get("youtubeRefreshToken")),
    )


@router.post("/connect", response_model=ConnectResult)
async def yt_connect(x_mayo_session: Optional[str] = Header(default=None)) -> ConnectResult:
    user = _require_user(x_mayo_session)
    try:
        return ConnectResult(url=youtube.start_connect(user["id"]))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))


@callback_router.get("/callback")
async def yt_callback(code: str = "", state: str = "") -> HTMLResponse:
    user_id = youtube.consume_state(state)
    if not code or not user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid or expired state")
    try:
        tokens = await youtube.exchange_code(code)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    refresh = tokens.get("refresh_token")
    if not refresh:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Google returned no refresh token")
    users.set_youtube_token(user_id, refresh)
    return HTMLResponse(
        "<html><body style='font-family:sans-serif;text-align:center;padding-top:80px'>"
        "<h2>✅ YouTube 연결 완료</h2><p>앱으로 돌아가 게시를 눌러주세요.</p></body></html>"
    )
