"""Conversational director endpoint — the chat-driven scenario flow (ADR 0008).

The app sends the whole conversation each turn; the active ScenarioPlanner
(mock | claude, per MAYO_PLANNER_BACKEND) replies and returns an evolving
Screenplay draft. When the draft is approved the app generates a job from it.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from .. import runtime
from ..auth import paid_user_or_none
from ..config import settings
from ..planner import DirectorChatRequest, DirectorTurn, get_scenario_planner

router = APIRouter(prefix="/v1/director", tags=["director"])


@router.post("/chat", response_model=DirectorTurn)
async def chat(
    req: DirectorChatRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> DirectorTurn:
    # The Claude director runs on the owner's paid API key — when premium gating
    # is on, it's reserved for signed-in paid-plan users (ADR 0011/0012).
    if (
        settings.premium_gating
        and runtime.planner_backend() == "claude"
        and paid_user_or_none(x_mayo_session) is None
    ):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail="the Claude director is for paid plans — upgrade or switch director",
        )
    planner = get_scenario_planner()
    return await planner.converse(req.messages, req.seconds, req.tier)
