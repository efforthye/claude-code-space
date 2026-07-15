---
title: Mayo
type: service
status: planned
tags: [service, mayo, ai-video, expo, web, platform]
created: 2026-07-15
updated: 2026-07-15
---

# Mayo

A premium **AI long-form video generation platform**. App-first (Expo, iOS + Android) with an
identical web experience at **mayo.im**. Decision on the client stack: [[0003-expo-react-native-for-mobile-app]].

## The idea / differentiator
Typical AI video tools produce only ~10-second clips (image via models like *Nano Banana*, motion
via models like *Higgsfield*). **Mayo produces videos of any requested length** — 3 min, 30 min,
or more — assembled like a real film: a strong AI writes a coherent scenario/screenplay, breaks it
into scenes, generates each, and stitches them into one long, high-quality video.

Users pay a premium for high-quality generated video. Output includes **both** the full long video
**and** the individual fine-grained clips, exportable together.

## Key features
- **Any-length generation** — request a duration; AI plans scenario → scenes → clips → final cut.
- **Dual export** — the full stitched film + all segmented clips, in one export.
- **Selectable models & price tiers** — image-gen and video-gen providers are pluggable and grow
  over time; users can pick cheaper models for a lower price, or premium for best quality.
- **Retention & storage** — videos are large, so default retention is ~**7–14 days** (store +
  download during that window). Paid tiers extend retention/long-term storage.
- **Premium billing** — high-value generation is the paid product; pricing varies by model tier
  and storage.

## Platforms
- **App (primary):** Expo / React Native / TypeScript — distributed to iOS + Android.
- **Web:** **mayo.im** — same product on the web.
- **Code location:** Expo app lives in this workspace at **`apps/mayo/`**. Web frontend and the
  backend location are TBD (see open decisions).

## Architecture sketch (draft — not locked)
- **Clients:** Expo app + mayo.im web (share a backend API). Web could reuse the RN codebase via
  React Native Web, or be a separate frontend — open decision.
- **Orchestration API:** takes a prompt + desired length → generates scenario/screenplay → splits
  into scenes → per scene calls image-gen then video-gen models → stitches clips → produces the
  full film + segments. (FastAPI is a natural fit — matches the existing [[richclub]] stack.)
- **Async job pipeline:** generation is long-running → a job queue + workers with progress
  tracking (a 30-min film = many scene jobs). Users watch progress, then download.
- **Model registry:** pluggable image/video providers (Nano Banana, Higgsfield, and future ones)
  each with a price tier; user selects per job. New models can be added without client changes.
- **Storage + lifecycle:** large video files in object storage (S3-compatible — cloud like R2/
  Backblaze, or self-hosted MinIO). Lifecycle rules enforce the 7–14 day default retention; paid
  tiers extend it. Storage cost/space is a first-class concern.
- **Billing:** payment provider for premium/model-tier/retention charges.
- **Heavy AI compute is external:** the actual image/video generation runs on **external AI
  provider APIs**, not on the [[home-server]] — so the mini can host the orchestration API + web +
  queue, while generation happens off-box. Long-term video storage will likely outgrow the mini's
  disk → plan object storage early.

## Hosting
- Initial orchestration API + web can run on the [[home-server]] (M1 mini) via Docker, deployed
  through [[jenkins]] like [[richclub]]. Generation is external APIs; bulk video storage → object
  storage (not the mini's local disk long-term).

## Config & secrets (pointers only — never values)
Will need API keys for each AI model provider (image + video), an object-storage credential, and a
payment-provider key. **Record names/locations only**, values go in a secret store (e.g. the
`HOME_SERVER` env or a dedicated store) — see `CLAUDE.md` security rule.

## Open decisions (to ADR as we choose)
- Backend stack (FastAPI?) and job-queue tech (Redis+workers / Celery / RQ / …).
- Web approach: RN-Web shared codebase vs. separate web frontend for mayo.im.
- Object-storage provider + retention/lifecycle implementation.
- Payment/billing provider and pricing model (per-length? per-model-tier? credits?).
- Scenario→scenes→clips→stitch pipeline design and how models are abstracted behind the registry.
- First set of image/video models to integrate.

## Related
- Client decision: [[0003-expo-react-native-for-mobile-app]]
- Dev loop: [[expo-dev-loop]] · Host: [[home-server]] · CI: [[jenkins]]
- Related app in repo: [[richclub]] (existing FastAPI + front — reference for stack)
