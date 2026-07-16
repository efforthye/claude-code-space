"""Storage interface — local first, S3 later (ADR 0004).

All media access goes through this interface so the Phase 1 → Phase 2 switch is
a config flip, not a rewrite. Only the local backend is implemented now; the S3
backend is a declared stub so the seam exists from day one.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod

from .config import settings


class StorageBackend(ABC):
    @abstractmethod
    def save(self, key: str, data: bytes) -> str: ...

    @abstractmethod
    def url(self, key: str) -> str: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...


class LocalStorage(StorageBackend):
    def __init__(self, root: str) -> None:
        self.root = root

    def _path(self, key: str) -> str:
        return os.path.join(self.root, key)

    def save(self, key: str, data: bytes) -> str:
        path = self._path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(data)
        return key

    def url(self, key: str) -> str:
        return f"/media/{key}"

    def delete(self, key: str) -> None:
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass

    def exists(self, key: str) -> bool:
        return os.path.exists(self._path(key))


class S3Storage(StorageBackend):
    """Phase 2 stub — wired when media outgrows ~half the host disk (ADR 0004)."""

    def save(self, key: str, data: bytes) -> str:  # pragma: no cover - not yet used
        raise NotImplementedError("S3 backend not wired yet — see ADR 0004")

    def url(self, key: str) -> str:  # pragma: no cover
        raise NotImplementedError("S3 backend not wired yet — see ADR 0004")

    def delete(self, key: str) -> None:  # pragma: no cover
        raise NotImplementedError("S3 backend not wired yet — see ADR 0004")

    def exists(self, key: str) -> bool:  # pragma: no cover
        raise NotImplementedError("S3 backend not wired yet — see ADR 0004")


def get_storage() -> StorageBackend:
    if settings.storage_backend == "s3":
        return S3Storage()
    return LocalStorage(settings.storage_local_path)
