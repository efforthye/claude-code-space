"""Conversational director endpoint — the chat-driven scenario flow (ADR 0008).

The app sends the whole conversation each turn; the active ScenarioPlanner
(mock | claude, per MAYO_PLANNER_BACKEND) replies and returns an evolving
Screenplay draft. When the draft is approved the app generates a job from it.
"""

from fastapi import APIRouter

from ..planner import DirectorChatRequest, DirectorTurn, get_scenario_planner

router = APIRouter(prefix="/v1/director", tags=["director"])


@router.post("/chat", response_model=DirectorTurn)
async def chat(req: DirectorChatRequest) -> DirectorTurn:
    planner = get_scenario_planner()
    return await planner.converse(req.messages, req.seconds, req.tier)
