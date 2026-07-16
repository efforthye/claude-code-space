---
title: Mayo
type: service
status: building
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
- **Publish to YouTube** — upload a finished video straight to the user's YouTube channel from the
  app (title/description/visibility), no manual download-and-reupload. (Other platforms later.)

## Platforms
- **App (primary):** Expo / React Native / TypeScript — distributed to iOS + Android.
- **Web:** **mayo.im** — same product on the web.
- **Code location:** Expo app lives in this workspace at **`apps/mayo/`**. Web frontend and the
  backend location are TBD (see open decisions).

## Current state — app shell scaffolded (2026-07-15)
UI-only shell (no backend yet), **Expo SDK 54** / React Native 0.81 / TypeScript. Typechecks
clean (`tsc`) **and bundles clean** (`expo export`).

**Why SDK 54 (diagnosed, not guessed):** the App Store **Expo Go currently supports only SDK 54**
— per Expo's status, the SDK 55 and 57 Expo Go builds are stuck in **Apple review**, so 55/56/57
projects all fail with *"requires a newer version of Expo Go."* Expo Go runs exactly one SDK (the
store-approved one), so **54 is the match** for running in Expo Go today. Options to go newer:
SDK 56 via **TestFlight** external beta, or SDK 57 via `eas go`. The durable fix is a
**development build** (bakes our SDK in → immune to Expo Go's review lottery) — see
[[expo-go-vs-dev-build]]. mayo will need a dev build anyway once native modules arrive.

Trimmed the template's SDK-57-only extras; fixed `use-theme` for RN 0.81's `useColorScheme`.

**Navigation:** a root **Stack** (`src/app/_layout.tsx`) wraps the tab group so detail screens and
modals can stack over the tabs. The root Stack holds three routes: `(tabs)` (the tab bar),
`library/[id]` (video detail, card push), and `publish` (YouTube publish, **modal** presentation).
The tabs themselves live in `src/app/(tabs)/_layout.tsx` — `(tabs)` is a transparent route group,
so tab URLs are unchanged.

Four tabs built with mock data:
- **Create** (`(tabs)/index.tsx`) — prompt, length selector (3m/10m/30m/1hr+), quality & model
  tier (Draft/Standard/Premium), estimated-cost card, Generate button.
- **Jobs** (`(tabs)/jobs.tsx`) — per-job scene progress bars + status (queued/generating/done/failed).
- **Library** (`(tabs)/library.tsx`) — finished videos, size, **retention "expires in N days"**;
  storage-usage bar (ties to [[0004-mayo-storage-local-then-s3]]). Each card taps through to the
  **video detail** screen; a YouTube icon opens the publish modal directly.
- **Account** (`(tabs)/account.tsx`) — plan, storage, retention extension, model prefs, **Appearance
  (System/Light/Dark)** and **Language (System/English/한국어)** pickers.

Stacked screens:
- **Video detail** (`library/[id].tsx`) — poster, spec sheet (duration/size/resolution/quality/
  scenes/created), retention line, and actions: publish to YouTube, download film, download clips,
  extend retention. Looks up the video via `getVideo(id)`; shows a not-found state for missing ids.
- **Publish modal** (`publish.tsx`) — title (prefilled from the video), description, visibility
  chips (Private/Unlisted/Public), a note about the YouTube upload quota, and a Publish button
  (disabled until there's a title). Backend wiring (OAuth2 + Data API upload) comes later.
- **Job detail** (`jobs/[id].tsx`) — status, progress bar, a bounded **scene-progress dot map**
  (capped at 48 dots), a status note, and status-specific actions (View in Library when done,
  Retry when failed). Looks up the job via the jobs store; not-found state for missing ids.
- **Extend retention modal** (`extend.tsx`) — shows the video's current expiry and radio-style
  retention plans (+7 days / +30 days / keep indefinitely) with per-plan credit cost, from
  `RETENTION_PLANS` in the mock data. Opened from the detail screen's "extend retention" action.
  Billing wiring comes later.

**Generate flow (end-to-end, UI-only):** an in-memory **jobs store** (`src/store/jobs.tsx`,
`JobsProvider` + `useJobs`) seeds from the mock `JOBS` and lets **Create** add a real "queued" job
(title from the prompt, scene count derived from the chosen length). Generate now pushes straight
into that job's detail screen; the **Jobs** tab reads live from the store and each card taps into
its detail. State isn't persisted — a backend job-queue replaces this store later.

**Theming, i18n & prefs:** app-wide **Settings** context (`src/settings/settings.tsx`) holds theme
mode, language, **and the default model tier**, all **persisted via AsyncStorage**. Account exposes
the default-model tier as an inline picker (Draft/Standard/Premium); **Create** initializes its
tier from that saved default. `useTheme()` resolves colors from the chosen scheme
(falls back to OS); `useI18n().t(key)` resolves strings from `src/i18n/translations.ts` (en/ko,
`{param}` interpolation). Length presets extended to 10 sec … 1 hr+ with a Custom sec/min input.

**Run it (on a Mac with the repo cloned):**
```bash
cd apps/mayo && npm install && npx expo start
```
Then scan the QR with Expo Go (iOS/Android) — see [[expo-dev-loop]]. Backend/model wiring comes
next; today the screens use `src/mocks/data.ts`.

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
- **Storage + lifecycle:** phased — **local filesystem first, S3-compatible object storage when
  it outgrows ~half the host disk** ([[0004-mayo-storage-local-then-s3]]). Access goes through a
  storage interface (`local`/`s3` backends) from day one so the switch is config-only. Retention
  (7–14 day default, paid extension) is enforced app-side regardless of backend.
- **Billing:** payment provider for premium/model-tier/retention charges.
- **Heavy AI compute is external:** the actual image/video generation runs on **external AI
  provider APIs**, not on the [[home-server]] — so the mini can host the orchestration API + web +
  queue, while generation happens off-box. Long-term video storage will likely outgrow the mini's
  disk → plan object storage early.
- **Publishing integrations:** upload finished videos to **YouTube** via the YouTube Data API v3
  (per-user OAuth2, resumable upload straight from storage). Note the API's upload quota (~1600
  units/upload against a default 10k/day → few uploads/day without a quota increase). Designed as a
  pluggable "publisher" so other platforms (TikTok/Instagram/etc.) can be added later.

## Hosting
- **Confirmed:** mayo runs on the [[home-server]] — the operator's "MacBook" is this same **M1
  Mac mini** (one machine). Orchestration API + web run there via Docker, deployed through
  [[jenkins]] like [[richclub]]. Generation is external APIs; bulk video storage → object storage
  (not the mini's local disk long-term, per [[0004-mayo-storage-local-then-s3]]).

## Config & secrets (pointers only — never values)
Will need API keys for each AI model provider (image + video), an object-storage credential, and a
payment-provider key. **Record names/locations only**, values go in a secret store (e.g. the
`HOME_SERVER` env or a dedicated store) — see `CLAUDE.md` security rule.

## Open decisions (to ADR as we choose)
- Backend stack (FastAPI?) and job-queue tech (Redis+workers / Celery / RQ / …).
- Web approach: RN-Web shared codebase vs. separate web frontend for mayo.im.
- Payment/billing provider and pricing model (per-length? per-model-tier? credits?).
- Scenario→scenes→clips→stitch pipeline design and how models are abstracted behind the registry.
- First set of image/video models to integrate.
- YouTube publishing: OAuth2 app setup + handling the Data API upload quota (batching / quota
  increase request); design the pluggable "publisher" interface.
- **Resolved:** storage strategy — local-first, S3 later ([[0004-mayo-storage-local-then-s3]]).
- **Resolved:** host — the [[home-server]] M1 mini (the operator's "MacBook" = same machine).

## Related
- Client decision: [[0003-expo-react-native-for-mobile-app]]
- Dev loop: [[expo-dev-loop]] · Host: [[home-server]] · CI: [[jenkins]]
- Related app in repo: [[richclub]] (existing FastAPI + front — reference for stack)
