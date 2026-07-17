"""Pydantic schemas — the API's wire types.

These intentionally mirror the Expo app's mock shapes in
`apps/mayo/src/mocks/data.ts` so the client can swap its local mocks for these
endpoints with minimal churn.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

JobStatus = Literal["queued", "generating", "done", "failed"]
Visibility = Literal["private", "unlisted", "public"]
ModelKind = Literal["image", "video"]


class Tier(BaseModel):
    id: str
    label: str
    blurb: str
    pricePerMin: int


class Duration(BaseModel):
    id: str
    label: str
    seconds: int


class Plan(BaseModel):
    id: str
    monthly: int
    storageMb: int = 0  # storage allowance for this plan (MB)


class RetentionPlan(BaseModel):
    id: str
    days: int  # 0 == keep indefinitely
    credits: int


class ModelProvider(BaseModel):
    id: str
    name: str
    kind: ModelKind
    tier: str  # references a Tier.id
    blurb: str


class DirectorModel(BaseModel):
    id: str  # a Claude model id, e.g. "claude-opus-4-8"
    name: str
    tier: str  # references a Tier.id
    blurb: str


class Job(BaseModel):
    id: str
    title: str
    status: JobStatus
    scenesDone: int
    scenesTotal: int
    etaMin: Optional[int] = None
    tierLabel: Optional[str] = None
    seconds: Optional[int] = None
    # Per-scene generation prompts from the AI director (when a screenplay drove
    # the job); the worker renders scene i from scenePrompts[i]. None -> use title.
    scenePrompts: Optional[list[str]] = None
    # Playback paths of scene clips already rendered — lets the app preview a job
    # while it's still generating.
    sceneUrls: Optional[list[str]] = None
    # Consistency block (style + character sheet) prepended to EVERY scene render.
    stylePrompt: Optional[str] = None
    # Credits charged at creation (refunded pro-rata on cancel).
    chargedCredits: Optional[int] = None


class CreateJobRequest(BaseModel):
    prompt: str = Field(default="", max_length=2000)
    seconds: int = Field(ge=1, le=6 * 60 * 60)
    tier: str = "standard"
    # Optional per-scene prompts (e.g. from the director's screenplay). When set,
    # the scene count follows this list instead of being derived from seconds.
    scenePrompts: list[str] = Field(default_factory=list)
    # Style + character-sheet block applied to every scene for visual consistency.
    stylePrompt: str = Field(default="", max_length=1500)


class Estimate(BaseModel):
    seconds: int
    tier: str
    credits: int


class StoryboardRequest(BaseModel):
    """Per-scene still previews rendered BEFORE the (expensive) video job."""

    scenePrompts: list[str] = Field(min_length=1, max_length=24)
    stylePrompt: str = Field(default="", max_length=1500)


class Storyboard(BaseModel):
    id: str
    status: str  # generating | done | failed
    total: int
    done: int
    # One playback path per scene ("/v1/media/storyboards/..."), null while that
    # scene is still rendering (or failed). Video paths show via /v1/thumb.
    images: list[Optional[str]]


class Video(BaseModel):
    id: str
    title: str
    durationLabel: str
    sizeLabel: str
    expiresInDays: int
    accent: str
    resolution: str
    tierLabel: str
    scenes: int
    createdLabel: str
    # Playback path of the stitched film (e.g. "/v1/media/films/<id>.mp4"), when a
    # real backend produced one. None for mock/metadata-only videos.
    url: Optional[str] = None
    # Where this video was published (e.g. https://youtu.be/<id>), once it was.
    youtubeUrl: Optional[str] = None
    # Generation recipe — kept so the AI director can load and REVISE this film
    # ("2번 장면을 밤으로" -> updated screenplay -> re-render as a new video).
    prompt: Optional[str] = None
    scenePrompts: Optional[list[str]] = None
    stylePrompt: Optional[str] = None  # consistency block used at render time


class Storage(BaseModel):
    usedLabel: str
    totalLabel: str
    usedRatio: float
    usedBytes: int = 0  # raw usage, so the client can meter against the plan cap


class EditClip(BaseModel):
    videoId: str  # a Library video to use as a source clip
    start: float = Field(default=0, ge=0)  # trim in-point (seconds)
    end: Optional[float] = Field(default=None, ge=0)  # trim out-point; None = to end
    text: str = Field(default="", max_length=120)  # optional caption burned onto the clip
    textPosition: Literal["top", "center", "bottom"] = "bottom"
    speed: float = Field(default=1.0, ge=0.25, le=4.0)  # playback speed multiplier
    filter: Literal["none", "mono", "warm", "cool", "vivid"] = "none"  # color look


class EditRequest(BaseModel):
    title: str = Field(default="My edit", max_length=100)
    clips: list[EditClip] = Field(min_length=1)
    # Optional audio track (voiceover/BGM) — a storage key from POST /v1/edit/audio,
    # muxed over the stitched cut (trimmed to the shorter of the two).
    audioKey: Optional[str] = None


class AudioUploadResult(BaseModel):
    key: str  # storage key to pass back as EditRequest.audioKey


class ExploreItem(BaseModel):
    """A public creation shown in the Explore feed (browse + 'make like this')."""

    id: str
    title: str
    prompt: str  # the prompt behind it — powers "make like this"
    author: str
    likes: int
    durationLabel: str
    accent: str
    tierLabel: str
    url: Optional[str] = None  # playback path of the published film
    createdLabel: str = "just now"
    comments: int = 0  # comment count
    views: int = 0  # reel impressions (app pings /view when a reel becomes active)
    createdAt: float = 0.0  # unix seconds; drives the ranking's time decay
    # Full recipe so anyone can REUSE this creation as a template in the director.
    scenePrompts: Optional[list[str]] = None
    stylePrompt: Optional[str] = None


class ExploreComment(BaseModel):
    id: str
    author: str
    text: str
    createdLabel: str = "just now"


class CommentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class PublishExploreRequest(BaseModel):
    videoId: str
    prompt: str = ""  # optional; the remix seed (falls back to the video title)


class ExtendRequest(BaseModel):
    plan: str  # references a RetentionPlan.id


class PublishRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=5000)
    visibility: Visibility = "private"
    tags: list[str] = Field(default_factory=list, max_length=30)


class PublishResult(BaseModel):
    accepted: bool
    videoId: str
    visibility: Visibility
    url: Optional[str] = None  # public link when a real upload happened


class BillingProduct(BaseModel):
    id: str  # store product id, e.g. 'im.mayo.pro.monthly'
    planId: str
    priceLabel: str


class ValidateRequest(BaseModel):
    productId: str
    platform: Literal["appstore", "playstore", "mock"] = "mock"
    receipt: Optional[str] = None


class ValidateResult(BaseModel):
    entitled: bool
    planId: str
