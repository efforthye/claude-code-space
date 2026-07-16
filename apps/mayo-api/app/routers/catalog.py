from fastapi import APIRouter

from .. import catalog
from ..schemas import DirectorModel, Duration, ModelProvider, Plan, RetentionPlan, Tier

router = APIRouter(prefix="/v1/catalog", tags=["catalog"])


@router.get("/tiers", response_model=list[Tier])
async def tiers() -> list[Tier]:
    return catalog.TIERS


@router.get("/durations", response_model=list[Duration])
async def durations() -> list[Duration]:
    return catalog.DURATIONS


@router.get("/plans", response_model=list[Plan])
async def plans() -> list[Plan]:
    return catalog.PLANS


@router.get("/retention-plans", response_model=list[RetentionPlan])
async def retention_plans() -> list[RetentionPlan]:
    return catalog.RETENTION_PLANS


@router.get("/models", response_model=list[ModelProvider])
async def models() -> list[ModelProvider]:
    return catalog.MODELS


@router.get("/directors", response_model=list[DirectorModel])
async def directors() -> list[DirectorModel]:
    return catalog.DIRECTOR_MODELS
