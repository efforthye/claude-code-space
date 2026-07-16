"""Auth endpoints — register/login (email+password), Google sign-in, sessions.

The shared API key (security.py) still gates all of /v1/*; these endpoints add
per-user identity on top. The app stores the returned session token and sends it
as `X-Mayo-Session` on later requests.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from ..auth import (
    AuthUser,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    SessionResult,
    store,
    to_public,
    verify_google_id_token,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/register", response_model=SessionResult, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest) -> SessionResult:
    if store.by_email(req.email):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email already registered")
    user = store.create_user(req.email, req.name, provider="email", password=req.password)
    return SessionResult(token=store.create_session(user["id"]), user=to_public(user))


@router.post("/login", response_model=SessionResult)
async def login(req: LoginRequest) -> SessionResult:
    user = store.by_email(req.email)
    if not user or not store.check_password(user, req.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="wrong email or password")
    return SessionResult(token=store.create_session(user["id"]), user=to_public(user))


from pydantic import BaseModel  # noqa: E402

from ..auth import start_google_login, take_login_result  # noqa: E402


class GoogleStartResult(BaseModel):
    loginId: str
    url: str


class GoogleLoginPoll(BaseModel):
    status: str  # "pending" | "ready"
    token: str | None = None
    user: AuthUser | None = None


@router.post("/google/start", response_model=GoogleStartResult)
async def google_start() -> GoogleStartResult:
    """Server-driven Google login (Expo Go-safe): returns a one-time loginId and
    the Google consent URL; the app opens it and polls /google/result."""
    try:
        login_id, url = start_google_login()
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return GoogleStartResult(loginId=login_id, url=url)


@router.get("/google/result", response_model=GoogleLoginPoll)
async def google_result(loginId: str = "") -> GoogleLoginPoll:
    result = take_login_result(loginId)
    if not result:
        return GoogleLoginPoll(status="pending")
    return GoogleLoginPoll(status="ready", token=result["token"], user=AuthUser(**result["user"]))


@router.post("/google", response_model=SessionResult)
async def google_login(req: GoogleLoginRequest) -> SessionResult:
    try:
        claims = await verify_google_id_token(req.idToken)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    user = store.by_email(claims["email"])
    if not user:
        user = store.create_user(
            claims["email"], claims.get("name", ""), provider="google", password=None
        )
    return SessionResult(token=store.create_session(user["id"]), user=to_public(user))


from pydantic import BaseModel, Field  # noqa: E402  (router-local wire types)

_BYOK_PROVIDERS = ("anthropic", "gemini", "higgsfield")


class ByokKeysRequest(BaseModel):
    # Empty string removes the stored key; omitted fields are left unchanged.
    anthropic: str | None = Field(default=None, max_length=500)
    gemini: str | None = Field(default=None, max_length=500)
    higgsfield: str | None = Field(default=None, max_length=500)


class ByokStatus(BaseModel):
    # provider -> masked tail (e.g. "…4gAA"); absent providers have no key.
    keys: dict[str, str]


def _masked(user: dict) -> ByokStatus:
    stored = user.get("byokKeys", {})
    return ByokStatus(keys={k: "…" + v[-4:] for k, v in stored.items() if v})


def _require_user(token: str | None) -> dict:
    user = store.user_for_session(token or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not signed in")
    return user


@router.get("/me/keys", response_model=ByokStatus)
async def my_keys(x_mayo_session: Optional[str] = Header(default=None)) -> ByokStatus:
    return _masked(_require_user(x_mayo_session))


@router.put("/me/keys", response_model=ByokStatus)
async def put_keys(
    req: ByokKeysRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> ByokStatus:
    user = _require_user(x_mayo_session)
    updates = {p: getattr(req, p) for p in _BYOK_PROVIDERS if getattr(req, p) is not None}
    store.set_byok_keys(user["id"], updates)
    return _masked(store.users[user["id"]])


@router.get("/me", response_model=AuthUser)
async def me(x_mayo_session: Optional[str] = Header(default=None)) -> AuthUser:
    user = store.user_for_session(x_mayo_session or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not signed in")
    return to_public(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(x_mayo_session: Optional[str] = Header(default=None)) -> None:
    if x_mayo_session:
        store.drop_session(x_mayo_session)
