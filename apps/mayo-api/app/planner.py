"""Scenario planner — the AI "director/screenwriter" step.

This is mayo's quality lever: a strong LLM turns a one-line prompt + desired
length into a coherent **screenplay** — a logline, a style guide (for visual
continuity across scenes), and an ordered list of scenes, each with a detailed
image/video-generation prompt, motion notes, and a duration. The per-scene
prompts are what the model backend (app/providers.py, ADR 0007) actually renders,
so a better plan → a better film, independent of the pixel models.

Two implementations, selected by MAYO_PLANNER_BACKEND (mock | claude):
- MockScenarioPlanner (default) — deterministic, no API key; splits the prompt
  into scenes so the pipeline runs end-to-end offline.
- ClaudeScenarioPlanner — uses the Anthropic SDK to have Claude write the
  screenplay as structured output. Model is selectable (MAYO_DIRECTOR_MODEL,
  default claude-opus-4-8) from the director catalog in catalog.py.

The planner sits in front of per-scene generation; see ADR 0008.
"""

from __future__ import annotations

import contextlib
from abc import ABC, abstractmethod
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from .catalog import scenes_for
from .config import settings


class Scene(BaseModel):
    index: int
    heading: str  # short scene slug, e.g. "Dawn over the harbor"
    prompt: str  # detailed image/video-generation prompt for this scene
    motion: str = ""  # camera/motion notes (pan, dolly, etc.)
    seconds: int


class Screenplay(BaseModel):
    title: str
    logline: str
    style: str  # style guide: palette, mood, characters — for cross-scene continuity
    scenes: List[Scene] = Field(default_factory=list)


# --- Conversational director ("대화형 AI 영상생성 플로우") -------------------
# Instead of a one-shot prompt, the user chats with the director to shape the
# film. Each turn sends the whole conversation; the director replies and, once it
# has a workable concept, returns a Screenplay draft it keeps revising until the
# user approves (ready=True), at which point the app can generate from it.


class DirectorMessage(BaseModel):
    role: Literal["user", "director"]
    content: str = Field(max_length=4000)


class DirectorChatRequest(BaseModel):
    # Full conversation so far, oldest first; the last turn is the user's.
    messages: List[DirectorMessage] = Field(default_factory=list)
    seconds: int = Field(default=60, ge=1, le=6 * 60 * 60)
    tier: str = "standard"


class DirectorTurn(BaseModel):
    reply: str  # the director's conversational reply (shown as a chat bubble)
    screenplay: Optional[Screenplay] = None  # current draft once one exists
    ready: bool = False  # the director considers the draft approved & buildable


class ScenarioPlanner(ABC):
    id: str

    @abstractmethod
    async def plan(self, prompt: str, seconds: int, tier: str) -> Screenplay:
        """Turn a prompt + desired length into a scene-by-scene screenplay."""

    @abstractmethod
    async def converse(
        self, messages: List[DirectorMessage], seconds: int, tier: str
    ) -> DirectorTurn:
        """Chat with the user, returning a reply + an evolving Screenplay draft."""


def _split_seconds(total: int, n: int) -> list[int]:
    base, extra = divmod(max(total, n), n)
    return [base + (1 if i < extra else 0) for i in range(n)]


class MockScenarioPlanner(ScenarioPlanner):
    """Deterministic stand-in — splits the prompt into evenly-timed scenes."""

    id = "mock"

    async def plan(self, prompt: str, seconds: int, tier: str) -> Screenplay:
        title = (prompt.strip().splitlines()[0][:60] if prompt.strip() else "Untitled film")
        n = scenes_for(seconds)
        durations = _split_seconds(seconds, n)
        scenes = [
            Scene(
                index=i,
                heading=f"Scene {i + 1}",
                prompt=f"{title} — beat {i + 1} of {n}. {prompt.strip()}".strip(" —"),
                motion="slow push-in" if i % 2 == 0 else "gentle pan",
                seconds=durations[i],
            )
            for i in range(n)
        ]
        return Screenplay(
            title=title,
            logline=prompt.strip()[:200] or title,
            style="cohesive palette and mood carried across all scenes",
            scenes=scenes,
        )

    async def converse(
        self, messages: List[DirectorMessage], seconds: int, tier: str
    ) -> DirectorTurn:
        # Deterministic stand-in for the Claude director: re-plans from everything
        # the user has said so far, and nudges toward "ready" after a couple of
        # turns or an explicit approval word. Replies are plain English — the real
        # (claude) backend converses fluently in the user's language.
        user_msgs = [m for m in messages if m.role == "user"]
        combined = "\n".join(m.content for m in user_msgs).strip()
        if not combined:
            return DirectorTurn(
                reply=(
                    "Tell me the film you want — a theme, a mood, characters, anything. "
                    "I'll draft a scene-by-scene screenplay and we'll refine it together."
                ),
                ready=False,
            )
        screenplay = await self.plan(combined, seconds, tier)
        turns = len(user_msgs)
        last = user_msgs[-1].content.lower()
        approved = any(w in last for w in _APPROVE_WORDS)
        ready = approved or turns >= 3
        if turns <= 1:
            reply = (
                f"Here's a first cut — “{screenplay.title}”, {len(screenplay.scenes)} "
                f"scenes across {seconds}s. Want to shift the tone or length, or add a beat? "
                "Or say “generate” and I'll build it."
            )
        elif not ready:
            reply = "Folded that in and refreshed the draft. Anything else, or shall I generate it?"
        else:
            reply = "Locked in — tap Generate and I'll start the render."
        return DirectorTurn(reply=reply, screenplay=screenplay, ready=ready)


# Approval cues (EN + KO) that flip the mock director to ready.
_APPROVE_WORDS = (
    "generate",
    "render",
    "build it",
    "go ahead",
    "looks good",
    "perfect",
    "ship it",
    "만들",
    "생성",
    "좋아",
    "좋습니다",
    "가자",
    "진행",
    "완성",
    "렌더",
)


_DIRECTOR_SYSTEM = (
    "You are a film director and screenwriter for an AI video generator. "
    "Given a prompt and a target total length in seconds, write a coherent short "
    "film as an ordered list of scenes. Maintain visual continuity across scenes "
    "via a shared style guide (palette, mood, recurring characters). For each "
    "scene, write a vivid, self-contained image/video-generation prompt, camera "
    "motion notes, and a duration in seconds. The scene durations must sum to the "
    "requested total. Keep scenes short (a few seconds each) so they render well."
)


_DIRECTOR_CHAT_SYSTEM = (
    "You are a warm, sharp film director collaborating with a user in chat to shape a short film "
    "for an AI video generator. Converse naturally IN THE USER'S LANGUAGE. When the brief is thin, "
    "ask at most one or two focused questions. As soon as you have a workable concept, include a "
    "`screenplay`: a title, a one-line logline, a style guide (palette, mood, recurring characters) "
    "for cross-scene continuity, and an ordered list of scenes — each with a vivid, self-contained "
    "image/video-generation prompt, camera-motion notes, and a duration in seconds. Revise the "
    "screenplay as the user gives feedback. Set `ready` to true only when the user clearly approves. "
    "Keep `reply` conversational and short; put the film itself in `screenplay`, not in the reply."
)


# Local LLMs use lightweight JSON mode (not schema-enforced), so the exact output
# shape is described in the prompt. Kept compact to keep small models on-track.
_SCREENPLAY_JSON_SHAPE = (
    ' Respond with ONLY a JSON object, no markdown, exactly: '
    '{"title": string, "logline": string, "style": string, "scenes": '
    '[{"index": integer, "heading": string, "prompt": string, "motion": string, '
    '"seconds": integer}]}.'
)
_TURN_JSON_SHAPE = (
    ' Respond with ONLY a JSON object, no markdown, exactly: '
    '{"reply": string, "ready": boolean, "screenplay": null OR '
    '{"title": string, "logline": string, "style": string, "scenes": '
    '[{"index": integer, "heading": string, "prompt": string, "motion": string, '
    '"seconds": integer}]}}. Put your chat message in "reply" (keep it short). '
    'Include "screenplay" once you have a concept; use null before then. Set '
    '"ready" true only when the user approves.'
)


class ClaudeScenarioPlanner(ScenarioPlanner):
    """Claude-powered director. Writes the screenplay as structured output.

    Requires the `anthropic` package (see requirements-ai.txt) and credentials in
    the environment (ANTHROPIC_API_KEY, or an `ant auth login` profile) — names
    only in the repo, values at runtime. Model selectable via MAYO_DIRECTOR_MODEL.
    """

    id = "claude"

    async def plan(self, prompt: str, seconds: int, tier: str) -> Screenplay:
        try:
            import anthropic  # lazy — only needed in claude mode
        except ImportError as exc:  # pragma: no cover - exercised only in claude mode
            raise RuntimeError(
                "anthropic not installed — `pip install -r requirements-ai.txt` "
                "to use MAYO_PLANNER_BACKEND=claude"
            ) from exc

        client = anthropic.AsyncAnthropic()  # reads ANTHROPIC_API_KEY / profile
        user = f"Prompt: {prompt}\nTotal length: {seconds} seconds."
        # Structured output: Claude returns a Screenplay directly (messages.parse
        # sets output_config.format from the Pydantic model). Adaptive thinking
        # for the planning reasoning. NOTE: claude-fable-5 additionally needs the
        # server-side `fallbacks` param — see the claude-api guidance before
        # switching MAYO_DIRECTOR_MODEL to fable.
        resp = await client.messages.parse(
            model=settings.director_model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=_DIRECTOR_SYSTEM,
            messages=[{"role": "user", "content": user}],
            output_format=Screenplay,
        )
        return resp.parsed_output

    async def converse(
        self, messages: List[DirectorMessage], seconds: int, tier: str
    ) -> DirectorTurn:
        try:
            import anthropic  # lazy — only needed in claude mode
        except ImportError as exc:  # pragma: no cover - exercised only in claude mode
            raise RuntimeError(
                "anthropic not installed — `pip install -r requirements-ai.txt` "
                "to use MAYO_PLANNER_BACKEND=claude"
            ) from exc

        if not messages:
            return DirectorTurn(reply="Tell me the film you'd like to make.", ready=False)

        client = anthropic.AsyncAnthropic()
        convo = [
            {"role": "assistant" if m.role == "director" else "user", "content": m.content}
            for m in messages
        ]
        system = (
            _DIRECTOR_CHAT_SYSTEM
            + f"\n\nTarget total length: {seconds} seconds. Quality tier: {tier}. "
            "Scene durations in any screenplay must sum to that total."
        )
        # One structured turn = a chat reply plus the evolving screenplay draft.
        # Same Fable-5 caveat as plan() applies if MAYO_DIRECTOR_MODEL is fable.
        resp = await client.messages.parse(
            model=settings.director_model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=system,
            messages=convo,
            output_format=DirectorTurn,
        )
        return resp.parsed_output


class LocalScenarioPlanner(ScenarioPlanner):
    """Free director backed by a **local LLM** (Ollama) — no paid API key.

    Talks to an Ollama-compatible server (MAYO_LOCAL_LLM_URL, default
    http://localhost:11434). Uses Ollama's lightweight JSON mode (format="json")
    rather than full schema-constrained decoding: small models (e.g. llama3.2:3b)
    are FAR faster in plain JSON mode, so a chat turn returns within the phone's
    ~60s request timeout. The expected JSON shape is described in the prompt and
    parsed leniently; if a small model drifts off-shape, converse() degrades
    gracefully instead of erroring. Pull a model first (`ollama pull llama3.2:3b`).
    See ADR 0008.
    """

    id = "local"

    async def _chat(self, messages: list[dict]) -> str:
        import httpx  # lazy — only needed in local mode

        url = settings.local_llm_url.rstrip("/") + "/api/chat"
        payload = {
            "model": settings.local_llm_model,
            "messages": messages,
            "stream": False,
            # Lightweight JSON mode (valid JSON, not schema-constrained). Grammar-
            # constraining a nested schema was overrunning the phone's 60s request
            # timeout on small models; plain JSON mode is much faster.
            "format": "json",
            # keep_alive holds the model in RAM between turns; num_predict caps
            # generation so a turn stays well under the client timeout.
            "keep_alive": "30m",
            "options": {"temperature": 0.6, "num_predict": 1200},
        }
        async with httpx.AsyncClient(timeout=settings.local_llm_timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return (data.get("message") or {}).get("content", "") or ""

    async def warm(self) -> None:
        """Best-effort: load the model into memory at startup so the user's first
        chat turn doesn't pay the cold-load latency (and time out on the phone)."""
        with contextlib.suppress(Exception):
            await self._chat([{"role": "user", "content": 'Reply with {"ok":true}'}])

    async def plan(self, prompt: str, seconds: int, tier: str) -> Screenplay:
        system = _DIRECTOR_SYSTEM + _SCREENPLAY_JSON_SHAPE
        user = f"Prompt: {prompt}\nTotal length: {seconds} seconds."
        content = await self._chat(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        return Screenplay.model_validate_json(content)

    async def converse(
        self, messages: List[DirectorMessage], seconds: int, tier: str
    ) -> DirectorTurn:
        if not messages:
            return DirectorTurn(reply="Tell me the film you'd like to make.", ready=False)
        system = (
            _DIRECTOR_CHAT_SYSTEM
            + f"\n\nTarget total length: {seconds} seconds. Quality tier: {tier}."
            + _TURN_JSON_SHAPE
        )
        convo: list[dict] = [{"role": "system", "content": system}]
        convo += [
            {"role": "assistant" if m.role == "director" else "user", "content": m.content}
            for m in messages
        ]
        try:
            content = await self._chat(convo)
            return DirectorTurn.model_validate_json(content)
        except Exception:
            # Server unreachable, timeout, or a small model returned off-shape JSON.
            # Degrade to a plain nudge rather than 500 the whole chat.
            return DirectorTurn(
                reply=(
                    "I couldn't shape that into a scene plan just now — try again, "
                    "or add a detail (setting, mood, or length)."
                ),
                ready=False,
            )


def get_scenario_planner() -> ScenarioPlanner:
    backend = settings.planner_backend
    if backend == "claude":
        return ClaudeScenarioPlanner()
    if backend == "local":
        return LocalScenarioPlanner()
    return MockScenarioPlanner()
