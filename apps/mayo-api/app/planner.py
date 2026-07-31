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

from . import runtime
from .catalog import scenes_for
from .config import settings


def _is_korean(text: str) -> bool:
    """True if the text contains Hangul — used to reply in the user's language."""
    return any("가" <= ch <= "힣" for ch in text)


def _clean_reply(text: str) -> str:
    """Strip leaked meta/planning text from a model's chat reply.

    Models occasionally prefix the actual answer with stage directions like
    "[user greets; reply warmly, keep in Korean]" — sometimes with the opening
    bracket lost to truncation (seen in production: "…Keep in Korean.] 안녕하세요!").
    Drop complete [ … ] blocks anywhere, plus a leading Hangul-free fragment
    that ends at an early ']' when the remaining reply IS Korean.
    """
    import re

    t = (text or "").strip()
    t = re.sub(r"\[[^\[\]]{0,400}\]", " ", t)
    i = t.find("]")
    if 0 <= i < 400:
        head, tail = t[:i], t[i + 1 :]
        if not _is_korean(head) and _is_korean(tail):
            t = tail
    return re.sub(r"[ \t]{2,}", " ", t).strip()


class Scene(BaseModel):
    index: int
    heading: str  # short scene slug, e.g. "Dawn over the harbor"
    prompt: str  # detailed image/video-generation prompt for this scene
    motion: str = ""  # camera/motion notes (pan, dolly, etc.)
    seconds: int


class Screenplay(BaseModel):
    title: str
    logline: str
    style: str  # style guide: palette, mood, lighting — for cross-scene continuity
    # Character sheet: ONE canonical visual descriptor per recurring character
    # (e.g. "a small orange tabby cat with a red scarf"). Scene prompts must
    # repeat these descriptors VERBATIM — that repetition is what keeps the
    # character visually consistent across separately-generated clips.
    characters: List[str] = Field(default_factory=list)
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
        self,
        messages: List[DirectorMessage],
        seconds: int,
        tier: str,
        api_key: Optional[str] = None,
    ) -> DirectorTurn:
        """Chat with the user, returning a reply + an evolving Screenplay draft.

        `api_key` is a per-user BYOK override (the caller's own provider key);
        only key-backed planners (claude) use it — mock/local ignore it."""


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
        self,
        messages: List[DirectorMessage],
        seconds: int,
        tier: str,
        api_key: Optional[str] = None,
    ) -> DirectorTurn:
        # Deterministic stand-in for the Claude director: re-plans from everything
        # the user has said so far, and nudges toward "ready" after a couple of
        # turns or an explicit approval word. Replies are plain English — the real
        # (claude) backend converses fluently in the user's language.
        user_msgs = [m for m in messages if m.role == "user"]
        combined = "\n".join(m.content for m in user_msgs).strip()
        ko = _is_korean(combined) if combined else _is_korean(
            "\n".join(m.content for m in messages)
        )
        if not combined:
            reply = (
                "어떤 영상을 만들고 싶으세요? 주제, 분위기, 등장인물 무엇이든 편하게 말씀해 주시면 "
                "씬 단위로 시나리오 초안을 잡아 함께 다듬어 드릴게요."
                if ko
                else (
                    "Tell me the film you want — a theme, a mood, characters, anything. "
                    "I'll draft a scene-by-scene screenplay and we'll refine it together."
                )
            )
            return DirectorTurn(reply=reply, ready=False)
        screenplay = await self.plan(combined, seconds, tier)
        turns = len(user_msgs)
        last = user_msgs[-1].content.lower()
        approved = any(w in last for w in _APPROVE_WORDS)
        ready = approved or turns >= 3
        if ko:
            if turns <= 1:
                reply = (
                    f"'{screenplay.title}' 초안을 잡아봤어요 — {seconds}초, "
                    f"씬 {len(screenplay.scenes)}개예요. 톤이나 길이를 바꾸거나 장면을 더할까요? "
                    "마음에 드시면 '생성'이라고 말씀해 주세요."
                )
            elif not ready:
                reply = "말씀 반영해서 초안을 다듬었어요. 더 손볼 부분 있으실까요, 아니면 생성할까요?"
            else:
                reply = "좋아요 — 생성 버튼을 누르시면 바로 렌더링을 시작할게요."
        else:
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
    "requested total. Keep scenes short (a few seconds each) so they render well. "
    "CONSISTENCY: define each recurring character ONCE in `characters` as an exact "
    "visual descriptor (species/hair/outfit/colors), and repeat that descriptor "
    "VERBATIM in every scene prompt that features the character. "
    "SCENE PROMPT FORM (MCSLA, per industry video-model guidance): order each scene "
    "prompt as Camera (shot type + camera move) -> Subject (the character descriptor) "
    "-> Look (style/palette/mood) -> Action (what happens). Keep identity fixed and "
    "vary ONLY the motion/action between scenes. Give the film an escalation arc "
    "(calm -> tension -> turn -> aftermath)."
)


_DIRECTOR_CHAT_SYSTEM = (
    "You are a warm, sharp film director collaborating with a user in chat to shape a short film "
    "for an AI video generator.\n"
    "LANGUAGE: Reply in EXACTLY the same language the user writes in. If they write Korean, reply "
    "in natural, fluent Korean (존댓말) — do NOT mix in English or Chinese characters.\n"
    "`reply` is ONLY the director's spoken message to the user. NEVER include meta notes, planning, "
    "stage directions, bracketed text like [ ... ], or descriptions of what you are about to do — "
    "the user sees `reply` verbatim as a chat bubble.\n"
    "NEVER echo, repeat, or paraphrase the user's message back at them — that is useless. Every "
    "reply must ADD something: either one focused question when the brief is genuinely too thin, or "
    "(preferably) a concrete creative proposal.\n"
    "As soon as you have any workable concept — even from a one-line idea — produce a `screenplay`: "
    "a title, a one-line logline, a style guide (palette, mood, recurring characters) for cross-scene "
    "continuity, and an ordered list of scenes, each with a vivid, self-contained image/video-"
    "generation prompt, camera-motion notes, and a duration in seconds. Prefer proposing a full draft "
    "over asking questions. Revise the screenplay as the user gives feedback. Set `ready` to true only "
    "when the user clearly approves (e.g. says to generate/make it). Keep `reply` to ONE or TWO short "
    "sentences describing what you drafted or changed; put the actual film in `screenplay`, not in the "
    "reply.\n"
    "CHARACTER CONSISTENCY: define each recurring character ONCE in `characters` as one exact visual "
    "descriptor phrase (species/hair/outfit/colors, e.g. 'a small orange tabby cat wearing a tiny red "
    "scarf'), and repeat that descriptor VERBATIM inside every scene prompt featuring the character — "
    "each clip renders independently, so only exact repetition keeps them looking identical.\n"
    "SCENE PROMPT FORM (MCSLA): order every scene prompt as Camera (shot type + move, e.g. 'slow "
    "dolly-in', 'FPV drone through alley') -> Subject (the exact character descriptor) -> Look "
    "(style/palette/mood) -> Action (the motion of this scene). Identity stays fixed; only the "
    "motion varies between scenes. Shape the scene list with an escalation arc "
    "(calm -> tension -> turn -> aftermath)."
)


# Local LLMs use lightweight JSON mode (not schema-enforced), so the exact output
# shape is described in the prompt. Kept compact to keep small models on-track.
_SCREENPLAY_JSON_SHAPE = (
    ' Respond with ONLY a JSON object, no markdown, exactly: '
    '{"title": string, "logline": string, "style": string, "characters": [string], "scenes": '
    '[{"index": integer, "heading": string, "prompt": string, "motion": string, '
    '"seconds": integer}]}.'
)
_TURN_JSON_SHAPE = (
    ' Respond with ONLY a JSON object, no markdown, exactly: '
    '{"reply": string, "ready": boolean, "screenplay": null OR '
    '{"title": string, "logline": string, "style": string, "characters": [string], "scenes": '
    '[{"index": integer, "heading": string, "prompt": string, "motion": string, '
    '"seconds": integer}]}}. Put a short chat message in "reply". If the user has '
    'described any concept, fill "screenplay" with a CONCISE draft — at most 2-4 '
    'short scenes, one sentence per scene prompt — and refine it each turn. If they '
    'have only greeted you or said nothing concrete, set "screenplay" to null and '
    'briefly ask what they want to make. Set "ready" true only when the user approves.'
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
        # switching the director model to fable.
        resp = await client.messages.parse(
            model=runtime.director_model(),
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=_DIRECTOR_SYSTEM,
            messages=[{"role": "user", "content": user}],
            output_format=Screenplay,
        )
        return resp.parsed_output

    async def converse(
        self,
        messages: List[DirectorMessage],
        seconds: int,
        tier: str,
        api_key: Optional[str] = None,
    ) -> DirectorTurn:
        ko = _is_korean("\n".join(m.content for m in messages))
        try:
            import anthropic  # lazy — only needed in claude mode
        except ImportError:
            # Package not installed on the host — tell the operator, don't 500.
            return DirectorTurn(
                reply=(
                    "Claude 감독을 쓰려면 서버에 anthropic 패키지 설치가 필요해요. "
                    "설정에서 '로컬' 또는 '기본' 감독으로 바꿔서 계속하실 수 있어요."
                    if ko
                    else (
                        "The Claude director needs the `anthropic` package on the server. "
                        "Switch the director to Local or Basic in Settings to continue."
                    )
                ),
                ready=False,
            )

        if not messages:
            return DirectorTurn(
                reply="어떤 영상을 만들고 싶으세요?" if ko else "Tell me the film you'd like to make.",
                ready=False,
            )

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
        # Same Fable-5 caveat as plan() applies if the director model is fable.
        try:
            client = anthropic.AsyncAnthropic(api_key=api_key) if api_key else anthropic.AsyncAnthropic()
            resp = await client.messages.parse(
                model=runtime.director_model(),
                max_tokens=16000,
                thinking={"type": "adaptive"},
                system=system,
                messages=convo,
                output_format=DirectorTurn,
            )
            turn = resp.parsed_output
            return turn.model_copy(update={"reply": _clean_reply(turn.reply)})
        except Exception:
            # Missing/invalid ANTHROPIC_API_KEY, network, refusal, or off-shape output.
            # Degrade to a helpful nudge in the user's language rather than 500.
            return DirectorTurn(
                reply=(
                    "지금 Claude 감독에 연결하지 못했어요. 서버에 API 키가 설정됐는지 확인하거나, "
                    "설정에서 '로컬'·'기본' 감독으로 바꿔 계속 진행해 주세요."
                    if ko
                    else (
                        "I couldn't reach the Claude director just now — check the server's API key, "
                        "or switch to the Local/Basic director in Settings to continue."
                    )
                ),
                ready=False,
            )


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
            # Bound generation so a turn stays comfortably under the phone's ~60s
            # request timeout even on a small model (a concise screenplay fits).
            "options": {"temperature": 0.6, "num_predict": 800},
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
        self,
        messages: List[DirectorMessage],
        seconds: int,
        tier: str,
        api_key: Optional[str] = None,
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
        ko = _is_korean("\n".join(m.content for m in messages))
        try:
            content = await self._chat(convo)
            turn = DirectorTurn.model_validate_json(content)
            return turn.model_copy(update={"reply": _clean_reply(turn.reply)})
        except Exception:
            # Server unreachable, timeout, or a small model returned off-shape JSON.
            # Degrade to a plain nudge rather than 500 the whole chat.
            return DirectorTurn(
                reply=(
                    "지금 장면 구성을 만들지 못했어요. 다시 시도하시거나 배경·분위기·길이 같은 "
                    "세부 내용을 조금 더 알려주세요."
                    if ko
                    else (
                        "I couldn't shape that into a scene plan just now — try again, "
                        "or add a detail (setting, mood, or length)."
                    )
                ),
                ready=False,
            )


def get_scenario_planner() -> ScenarioPlanner:
    # Runtime-selected (app-switchable via /v1/settings), falling back to the
    # .env default the first time before anything is persisted.
    backend = runtime.planner_backend()
    if backend == "claude":
        return ClaudeScenarioPlanner()
    if backend == "local":
        return LocalScenarioPlanner()
    # PROD RULE (owner: "the director doesn't really work"): mock is a dev stub.
    # If the host actually has a Claude credential, use the REAL director even
    # when nobody flipped the runtime switch — canned replies helped no one.
    import os

    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            import anthropic  # noqa: F401

            return ClaudeScenarioPlanner()
        except ImportError:
            pass
    return MockScenarioPlanner()
