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


class CreateJobRequest(BaseModel):
    prompt: str = Field(default="", max_length=2000)
    seconds: int = Field(ge=1, le=6 * 60 * 60)
    tier: str = "standard"


class Estimate(BaseModel):
    seconds: int
    tier: str
    credits: int


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


class Storage(BaseModel):
    usedLabel: str
    totalLabel: str
    usedRatio: float


class ExtendRequest(BaseModel):
    plan: str  # references a RetentionPlan.id


class PublishRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=5000)
    visibility: Visibility = "private"


class PublishResult(BaseModel):
    accepted: bool
    videoId: str
    visibility: Visibility


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
