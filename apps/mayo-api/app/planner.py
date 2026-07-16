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

from abc import ABC, abstractmethod
from typing import List

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


class ScenarioPlanner(ABC):
    id: str

    @abstractmethod
    async def plan(self, prompt: str, seconds: int, tier: str) -> Screenplay:
        """Turn a prompt + desired length into a scene-by-scene screenplay."""


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


_DIRECTOR_SYSTEM = (
    "You are a film director and screenwriter for an AI video generator. "
    "Given a prompt and a target total length in seconds, write a coherent short "
    "film as an ordered list of scenes. Maintain visual continuity across scenes "
    "via a shared style guide (palette, mood, recurring characters). For each "
    "scene, write a vivid, self-contained image/video-generation prompt, camera "
    "motion notes, and a duration in seconds. The scene durations must sum to the "
    "requested total. Keep scenes short (a few seconds each) so they render well."
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


def get_scenario_planner() -> ScenarioPlanner:
    if settings.planner_backend == "claude":
        return ClaudeScenarioPlanner()
    return MockScenarioPlanner()
