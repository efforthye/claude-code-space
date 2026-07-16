---
title: "ADR 0009: Mayo local video generation via ComfyUI (AnimateDiff/AnimateLCM)"
type: decision
status: accepted
tags: [decision, mayo, backend, ai, video, comfyui, local, home-server]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0009 — Mayo local video generation via ComfyUI

## Context
Real AI video generation needs pixel models, which are normally paid external APIs. The operator
wanted **real generation with no per-call cost**, running on the [[home-server]] (M1 mini, 16 GB).
The generation seam already existed ([[0007-mayo-model-provider-abstraction]] — `ModelBackend`);
this decision fills it with a **local** backend.

## Decision
Run **ComfyUI** on the mini as a launchd service (`com.efforthye.mayo.comfy`,
`scripts/mayo-comfy-run.sh`, serves `127.0.0.1:8188`) with **AnimateDiff-Evolved + AnimateLCM**
(SD1.5 + LCM LoRA + motion module) for fast text→video. A new `ComfyUIModelBackend`
(`app/providers.py`, selected by `generation_backend=comfy`) drives it per scene:

```
scene prompt ─▶ inject into workflows/animatelcm_t2v.json ─▶ POST /prompt ─▶ poll /history
             ─▶ download clip via /view ─▶ store via the storage interface (ADR 0004)
```

The worker then **stitches** the per-scene clips into one film with **ffmpeg** and files it into the
Library with a real playback `url` (served by `GET /v1/media/{key}`, Range-enabled for iOS). The app
plays it with `expo-video` and can download it (`expo-file-system` + share sheet).

**Key choices & findings:**
- **AnimateLCM** (few-step LCM) over vanilla AnimateDiff — ~6 min/clip on the M1 vs much longer;
  still the main cost. Speed levers exposed: `MAYO_COMFY_WIDTH/HEIGHT/FRAMES/STEPS` (steps 8→6).
- **Mac/MPS**: `PYTORCH_ENABLE_MPS_FALLBACK=1` is required (some diffusion ops lack Metal kernels).
- **Workflow as data**: the ComfyUI graph is a repo file (`workflows/animatelcm_t2v.json`), so it's
  versioned and tweakable; the backend injects prompt/seed/size. Confirmed end-to-end via
  `scripts/comfy-smoke.sh` (first clip: 362 s).
- **App-switchable**: generation backend is a runtime setting (`/v1/settings`, `runtime.py`,
  persisted) so the operator flips **mock ⇄ local** from the app, not by editing `.env`.
- **Model choice is director-adjacent**: the scenario per-scene prompts come from the AI director
  ([[0008-mayo-ai-director-scenario-planner]]); each scene renders its own shot.

## Consequences
- ✅ Real, free, local AI video on the home server — the full chain (director → scenes → clips →
  stitched film → play/download) works.
- ✅ Slots behind the existing `ModelBackend` seam; `mock` (instant placeholder) stays the default
  and the app toggle picks per install.
- ⚠️ Slow (minutes/scene) and low-res (512²) on a 16 GB M1 — fine for short films, not long ones.
  Optimisation = smaller size/frames/steps, or a beefier box, or an external API.
- ⚠️ Memory pressure: ComfyUI + the local LLM director + [[richclub]] on 16 GB is tight; heavy
  generation may want the director model unloaded.
- 🔜 Follow-ups: image-to-video (SVD) from a user-uploaded start frame (Higgsfield-style); real
  external video APIs behind the same seam for premium quality; per-user **BYOK** (own Higgsfield/
  Claude key → discounted price).

## Related
- Generation seam: [[0007-mayo-model-provider-abstraction]] · Director: [[0008-mayo-ai-director-scenario-planner]] ·
  Storage: [[0004-mayo-storage-local-then-s3]] · Service: [[mayo]] · Host: [[home-server]]
