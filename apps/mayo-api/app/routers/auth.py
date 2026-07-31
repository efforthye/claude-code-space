"""Auth endpoints — register/login (email+password), Google sign-in, sessions.

The shared API key (security.py) still gates all of /v1/*; these endpoints add
per-user identity on top. The app stores the returned session token and sends it
as `X-Mayo-Session` on later requests.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status

from ..access_log import log_auth_event, stamp_last_login
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


def _signed_in(action: str, request: Request, user: dict) -> SessionResult:
    """Issue a session and record where it was issued from.

    Every path that hands out a session goes through here, so adding a new
    sign-in method cannot silently skip the access log.
    """
    where = log_auth_event(action, request, user=user)
    stamp_last_login(store, user, where)
    return SessionResult(token=store.create_session(user["id"]), user=to_public(user))


@router.post("/register", response_model=SessionResult, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request) -> SessionResult:
    if store.by_email(req.email):
        log_auth_event(
            "register", request, outcome="failure", email=req.email, reason="email_taken"
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email already registered")
    user = store.create_user(req.email, req.name, provider="email", password=req.password)
    return _signed_in("register", request, user)


@router.post("/login", response_model=SessionResult)
async def login(req: LoginRequest, request: Request) -> SessionResult:
    user = store.by_email(req.email)
    if not user or not store.check_password(user, req.password):
        # Logged with the attempted address (never the password) so repeated
        # failures against one account, or one IP, are visible in Kibana.
        log_auth_event(
            "login", request, outcome="failure", email=req.email, reason="bad_credentials"
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="wrong email or password")
    return _signed_in("login", request, user)


from pydantic import BaseModel, Field  # noqa: E402

from ..auth import (  # noqa: E402
    complete_password_reset,
    start_google_login,
    start_password_reset,
    take_login_result,
)

# --- Password reset (email + 6-digit code; honest 501 when mail is unset) ---

_EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ResetStartRequest(BaseModel):
    email: str = Field(pattern=_EMAIL_RE, max_length=200)


class ResetCompleteRequest(BaseModel):
    email: str = Field(pattern=_EMAIL_RE, max_length=200)
    code: str = Field(min_length=4, max_length=10)
    newPassword: str = Field(min_length=8, max_length=200)


class OkResult(BaseModel):
    ok: bool = True


@router.post("/reset/start", response_model=OkResult)
async def reset_start(req: ResetStartRequest) -> OkResult:
    """Email a reset code. Always 200 for a valid request shape — whether the
    account exists is never revealed. 501 when the server can't send mail."""
    try:
        await start_password_reset(req.email)
    except ValueError as exc:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    except Exception:
        # SMTP hiccup — an honest failure beats a silent black hole.
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail="reset mail could not be sent — try again"
        )
    return OkResult()


@router.post("/reset/complete", response_model=SessionResult)
async def reset_complete(req: ResetCompleteRequest, request: Request) -> SessionResult:
    user = complete_password_reset(req.email, req.code, req.newPassword)
    if not user:
        log_auth_event(
            "password_reset", request, outcome="failure", email=req.email, reason="bad_code"
        )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="wrong or expired reset code")
    return _signed_in("password_reset", request, user)


class GoogleStartResult(BaseModel):
    loginId: str
    url: str


class GoogleLoginPoll(BaseModel):
    status: str  # "pending" | "ready"
    token: str | None = None
    user: AuthUser | None = None
    linked: str | None = None  # set instead of token/user for a link request


def _link_user_id(link: bool, session: str | None) -> str | None:
    """The signed-in caller's id when this start is a LINK request (?link=1)."""
    if not link:
        return None
    user = store.user_for_session(session or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in first to link accounts")
    return user["id"]


@router.post("/google/start", response_model=GoogleStartResult)
async def google_start(
    link: bool = False, x_mayo_session: Optional[str] = Header(default=None)
) -> GoogleStartResult:
    """Server-driven Google login (Expo Go-safe): returns a one-time loginId and
    the Google consent URL; the app opens it and polls /google/result.
    With ?link=1 (signed in), completion links Google to the current account."""
    try:
        login_id, url = start_google_login(link_user_id=_link_user_id(link, x_mayo_session))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return GoogleStartResult(loginId=login_id, url=url)


def _poll(loginId: str) -> GoogleLoginPoll:
    result = take_login_result(loginId)
    if not result:
        return GoogleLoginPoll(status="pending")
    if "linked" in result:
        return GoogleLoginPoll(status="ready", linked=result["linked"])
    return GoogleLoginPoll(status="ready", token=result["token"], user=AuthUser(**result["user"]))


@router.get("/google/result", response_model=GoogleLoginPoll)
async def google_result(loginId: str = "") -> GoogleLoginPoll:
    return _poll(loginId)


@router.post("/google", response_model=SessionResult)
async def google_login(req: GoogleLoginRequest, request: Request) -> SessionResult:
    try:
        claims = await verify_google_id_token(req.idToken)
    except ValueError as exc:
        log_auth_event("login_google", request, outcome="failure", reason="bad_id_token")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    user = store.by_email(claims["email"])
    if not user:
        user = store.create_user(
            claims["email"], claims.get("name", ""), provider="google", password=None
        )
    return _signed_in("login_google", request, user)


# --- GitHub sign-in (server-driven start/poll — same pattern as Google) ---

from fastapi.responses import HTMLResponse  # noqa: E402

from ..auth import (  # noqa: E402
    apple_login,
    complete_github_login,
    login_id_for_state,
    start_github_login,
)


@router.post("/github/start", response_model=GoogleStartResult)
async def github_start(
    link: bool = False, x_mayo_session: Optional[str] = Header(default=None)
) -> GoogleStartResult:
    try:
        login_id, url = start_github_login(link_user_id=_link_user_id(link, x_mayo_session))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return GoogleStartResult(loginId=login_id, url=url)


@router.get("/github/result", response_model=GoogleLoginPoll)
async def github_result(loginId: str = "") -> GoogleLoginPoll:
    return _poll(loginId)


@router.get("/github/callback", response_class=HTMLResponse)
async def github_callback(code: str = "", state: str = "") -> HTMLResponse:
    """GitHub's browser redirect — one-time state is its auth (no shared key)."""
    login_id = login_id_for_state(state) if state.startswith("ghlogin.") else None
    if not code or not login_id:
        return HTMLResponse("<h3>로그인 요청이 만료됐어요. 앱에서 다시 시도해주세요.</h3>", status_code=400)
    try:
        await complete_github_login(login_id, code)
    except Exception:
        return HTMLResponse("<h3>GitHub 로그인에 실패했어요. 앱에서 다시 시도해주세요.</h3>", status_code=400)
    return HTMLResponse(
        "<h3>로그인 완료! 이 창을 닫고 앱으로 돌아가세요.</h3>"
        "<script>setTimeout(function(){window.close()},1200)</script>"
    )


# --- Apple sign-in (identityToken from expo-apple-authentication) ---


class AppleLoginRequest(BaseModel):
    identityToken: str
    name: str = ""
    link: bool = False  # signed-in caller wants to LINK Apple to this account


@router.post("/apple", response_model=SessionResult)
async def apple_signin(
    req: AppleLoginRequest,
    request: Request,
    x_mayo_session: Optional[str] = Header(default=None),
) -> SessionResult:
    link_user = store.user_for_session(x_mayo_session or "") if req.link else None
    if req.link and not link_user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in first to link accounts")
    try:
        result = await apple_login(req.identityToken, req.name, link_user=link_user)
    except ValueError as exc:
        log_auth_event("login_apple", request, outcome="failure", reason="bad_identity_token")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    # Apple builds the session itself, so this path cannot use _signed_in().
    action = "link_apple" if req.link else "login_apple"
    user = store.users.get(result["user"].get("id", ""))
    where = log_auth_event(action, request, user=user or {"email": result["user"].get("email", "")})
    if user and not req.link:
        stamp_last_login(store, user, where)
    # For a link request there's no new session — hand the caller's back.
    token = result["token"] or (x_mayo_session or "")
    return SessionResult(token=token, user=AuthUser(**result["user"]))


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
