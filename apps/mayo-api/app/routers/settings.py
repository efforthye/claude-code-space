"""App-controllable runtime settings — flip generation mode without SSHing in.

GET /v1/settings  -> current runtime settings
PUT /v1/settings  -> change them (persisted via runtime.py)
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from .. import runtime

router = APIRouter(prefix="/v1/settings", tags=["settings"])


class RuntimeSettings(BaseModel):
    # "mock" (fast, free placeholder) | "comfy" (real local video) | "external".
    generationBackend: str
    # BYOK: run on your own provider key(s) for a fraction of the price.
    byok: bool = False


def _current() -> RuntimeSettings:
    return RuntimeSettings(generationBackend=runtime.generation_backend(), byok=runtime.byok())


@router.get("", response_model=RuntimeSettings)
async def get_settings() -> RuntimeSettings:
    return _current()


@router.put("", response_model=RuntimeSettings)
async def put_settings(body: RuntimeSettings) -> RuntimeSettings:
    try:
        runtime.set_generation_backend(body.generationBackend)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    runtime.set_byok(body.byok)
    return _current()
