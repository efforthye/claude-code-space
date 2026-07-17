from app.worker import _extra_clips_needed


def test_extra_clips_math():
    # 10s requested, 6s measured from 3 clips (avg 2s) -> 2 more clips
    assert _extra_clips_needed(10, 6, 3, 60) == 2
    # already long enough (within tolerance) -> none
    assert _extra_clips_needed(10, 9.9, 5, 60) == 0
    assert _extra_clips_needed(10, 10.5, 5, 60) == 0
    # capped by max_scenes
    assert _extra_clips_needed(100, 2, 59, 60) == 1
    assert _extra_clips_needed(100, 2, 60, 60) == 0
    # no measurement / no request -> no loop
    assert _extra_clips_needed(0, 6, 3, 60) == 0
    assert _extra_clips_needed(10, 0, 3, 60) == 0


def test_probe_parses_ffprobe_output(monkeypatch):
    import subprocess as sp

    from app import worker
    from app.storage import get_storage

    get_storage().save("clips/probe-test.mp4", b"fake-bytes")

    class R:
        stdout = b"12.48\n"

    monkeypatch.setattr(worker.subprocess, "run", lambda *a, **k: R())
    assert abs(worker._probe_seconds_sync("clips/probe-test.mp4") - 12.48) < 1e-6
    # missing key -> 0.0 without invoking ffprobe
    assert worker._probe_seconds_sync("clips/definitely-missing.mp4") == 0.0
