"""Conversational director endpoint — the chat-driven scenario flow (ADR 0008).

The app sends the whole conversation each turn; the active ScenarioPlanner
(mock | claude, per MAYO_PLANNER_BACKEND) replies and returns an evolving
Screenplay draft. When the draft is approved the app generates a job from it.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from .. import runtime
from ..auth import paid_user_or_none, store as users
from ..config import settings
from ..planner import DirectorChatRequest, DirectorTurn, get_scenario_planner

router = APIRouter(prefix="/v1/director", tags=["director"])


@router.post("/chat", response_model=DirectorTurn)
async def chat(
    req: DirectorChatRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> DirectorTurn:
    # BYOK: a signed-in user with their own Anthropic key runs the Claude
    # director on THEIR key (and it also satisfies the premium gate below).
    caller = users.user_for_session(x_mayo_session or "")
    own_key = users.byok_key(caller, "anthropic")

    # The Claude director otherwise runs on the owner's paid API key — when
    # premium gating is on, it's reserved for paid-plan users (ADR 0011/0012).
    if (
        settings.premium_gating
        and runtime.planner_backend() == "claude"
        and not own_key
        and paid_user_or_none(x_mayo_session) is None
    ):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail="the Claude director is for paid plans — upgrade, add your own key, or switch director",
        )
    planner = get_scenario_planner()
    return await planner.converse(req.messages, req.seconds, req.tier, api_key=own_key or None)
