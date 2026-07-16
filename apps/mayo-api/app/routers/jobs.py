from fastapi import APIRouter, HTTPException, status

from .. import catalog
from ..schemas import CreateJobRequest, Estimate, Job
from ..store import jobs as job_store
from ..worker import start_generation

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


@router.get("", response_model=list[Job])
async def list_jobs() -> list[Job]:
    return await job_store.list()


@router.post("/estimate", response_model=Estimate)
async def estimate(req: CreateJobRequest) -> Estimate:
    tier = catalog.tier_by_id(req.tier)
    if tier is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    return Estimate(seconds=req.seconds, tier=req.tier, credits=catalog.estimate_credits(req.seconds, tier))


@router.post("", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(req: CreateJobRequest) -> Job:
    if catalog.tier_by_id(req.tier) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    job = await job_store.create(req.prompt, req.seconds, req.tier, req.scenePrompts or None)
    start_generation(job.id)
    return job


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str) -> Job:
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str) -> None:
    removed = await job_store.remove(job_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
