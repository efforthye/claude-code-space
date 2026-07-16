---
title: Mayo
type: service
status: building
tags: [service, mayo, ai-video, expo, web, platform]
created: 2026-07-15
updated: 2026-07-16
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
- **Code location:** Expo app lives in this workspace at **`apps/mayo/`**; the orchestration API
  lives at **`apps/mayo-api/`** (FastAPI). Web frontend location is TBD (see open decisions).

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

**Web target ([[mayo-web-target]], 2026-07-16).** The same codebase now also builds for the **web**
(react-native-web + expo-router) so it can be the **mayo.im** website, not just the app. `web.output`
switched `static → single` (client SPA; static output crashed on `resetServerContext`); `npm run
build:web` (`expo export -p web`) emits `dist/`; `apps/mayo/vercel.json` deploys it (SPA rewrite,
Root Directory = `apps/mayo`). Native-only modules (notifications, media-library/file-system/sharing,
`Alert.alert`) are `Platform.OS==='web'`-guarded — web download uses a browser `<a download>`.
⚠️ Don't bake the shared API key into the public web bundle (it'd leak) — that ties a public mayo.im
to per-user **accounts**; until then keep it demo/read-mostly. iOS + web `expo export` both pass.

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
- **Plans & billing modal** (`plan.tsx`) — subscription tiers (Free / Pro / Studio) from `PLANS`
  with monthly price + tagline, current plan highlighted, and a Choose-plan CTA (disabled on the
  current plan). Opened from the Account plan card and the "Billing" row. Payment wiring comes later.

**Payments (app-native IAP, scaffolded 2026-07-16):** in-app purchases are coded against a
`PaymentProvider` interface (`src/payments/`) so a real provider drops in later without touching
screens. A **mock** provider runs today (Expo Go can't load StoreKit/Play Billing), granting the
entitlement locally (persisted via AsyncStorage). `usePayments()` exposes the entitlement, products,
`purchase()`/`selectFree()`/`restore()`; the **Plan** modal drives real purchase/restore flows and
the **Account** plan card reflects the live entitlement. Going live = a **dev build** + a real
provider (RevenueCat or `react-native-iap`) selected in `provider.ts`, gated on
`EXPO_PUBLIC_PAYMENTS`. Server seam exists: **`/v1/billing/products`** + **`/v1/billing/validate`**
(receipt-validation stub) in mayo-api. See `apps/mayo/src/payments/README.md`.

**Action feedback:** an app-wide **toast** (`src/components/toast.tsx`, `ToastProvider`/`useToast`)
pops a short confirmation banner after mock actions that otherwise dismiss silently — publish
("Published to YouTube"), extend retention, and plan change.

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

## Backend — Phase 1 scaffolded (2026-07-16)
The **orchestration API** now exists at **`apps/mayo-api/`** — **FastAPI + Pydantic v2**, served by
uvicorn, containerized (`Dockerfile`). Decisions: [[0005-mayo-backend-fastapi]] (why FastAPI) and
[[0006-mayo-job-queue-inprocess-then-redis]] (queue strategy). Deploy via [[deploy-mayo-api]].

**Phase 1 = real endpoints, mock generation.** The job model, library, retention, and publish
endpoints are real; the scenario→scenes→clips→stitch core is stood in by an **in-process asyncio
advancer** (`app/worker.py`) that walks a job scene-by-scene on a timer, then files a finished video
into the library — so the app's Create → Jobs → Library loop can run against a live server. Wire
schemas (`app/schemas.py`) **mirror the app mocks** so the client swaps mocks → HTTP mechanically.

Endpoints (v1): `POST /v1/jobs` (+ `/estimate`), `GET /v1/jobs[/{id}]`, `DELETE /v1/jobs/{id}`;
`GET /v1/library/videos[/{id}]`, `/storage`, `POST …/extend`, `POST …/publish`;
`GET /v1/catalog/{tiers,durations,plans,retention-plans,models}`; `GET /v1/billing/products` +
`POST /v1/billing/validate`; `GET /health`.

**Generation backend seam ([[0007-mayo-model-provider-abstraction]]):** per-scene model calls sit
behind a `ModelBackend` interface (`app/providers.py`), selected by `MAYO_GENERATION_BACKEND`. The
`mock` backend (default) advances a scene per tick; `comfy` renders real **local** video on the
mini ([[0009-mayo-local-video-generation-comfyui]]); and `external` renders via **paid cloud
providers — Nano Banana (Gemini 2.5 Flash Image) for stills + Higgsfield for video**
([[0010-mayo-external-generation-providers]], 2026-07-16). All three are runtime-switchable from the
app (Account → 생성 방식: 빠름 / 로컬 AI / 외부 API). External keys come from the host env
(`GEMINI_API_KEY`, `HF_KEY`) — names only in the repo; the Higgsfield model id + argument keys are
config-driven ("low-code") so they adapt to any model without a code change. Swapping backends is a
backend change, not a pipeline rewrite. Seams built in from
day one: **storage interface** (local now, S3 stub — [[0004-mayo-storage-local-then-s3]]), a
**pluggable model registry** (image/video providers keyed to price tiers), and **env-driven
config/secrets** (values at runtime, names-only in `.env.example`). Tested with `pytest`
(API + full generation lifecycle); **7/7 pass**.

**Deploy on the mini (hands-off):** a third launchd agent `com.efforthye.mayo.api` runs the API via
`scripts/mayo-api-run.sh` (self-bootstrapping venv → uvicorn on **:8001**, since [[richclub]] owns
:8000). Installed by `mayo-autostart-install.sh` alongside the Expo + autopull agents; `dev-autopull`
restarts it whenever `apps/mayo-api/**` is pushed, so backend changes go live with no manual step.
See [[deploy-mayo-api]].

**App ↔ API wired (2026-07-16).** The Expo app now talks to mayo-api for **all non-AI data** — the
client mocks are gone. `src/api/client.ts` (base URL from `EXPO_PUBLIC_MAYO_API_URL`, default
`:8001`) + a small `useQuery` hook drive: Create → `POST /v1/jobs`; Jobs tab polls `GET /v1/jobs`;
Job detail polls `GET /v1/jobs/{id}` (live progress) and cancels/deletes via `DELETE`; Library +
detail read `GET /v1/library/...`; extend/publish `POST` to the API. Catalog (tiers/durations/plans)
is fetched with a bundled fallback so forms render offline; screens show loading/error/retry states.
`app.json` allows cleartext HTTP (ATS) for dev builds hitting the mini over `http://`.

**AI director — scenario planner ([[0008-mayo-ai-director-scenario-planner]], 2026-07-16).** The
quality-defining step — a strong LLM that writes the screenplay before any pixels — is designed in
and pluggable now. A `ScenarioPlanner` seam (`app/planner.py`) turns *prompt + length* into a typed
**`Screenplay`** (title, logline, style, ordered `Scene`s each with a generation prompt, motion, and
duration), which then feeds the per-scene `ModelBackend`. Two backends chosen by
`MAYO_PLANNER_BACKEND`: **`mock`** (default, deterministic, offline — pipeline runs today) and
**`claude`** (Anthropic SDK `messages.parse` → `Screenplay` as structured output, adaptive thinking;
`anthropic` dep is optional/lazy in `requirements-ai.txt`). The **director model is user-selectable**
— `catalog.DIRECTOR_MODELS` (served at `GET /v1/catalog/directors`) lists Claude tiers Opus 4.8
(premium) / Sonnet 5 (standard) / Haiku 4.5 (draft), picked via `MAYO_DIRECTOR_MODEL`
(default `claude-opus-4-8`). Not yet wired into `worker.py` — folding plan → per-scene generate is
the next backend step (documented follow-up in the ADR). API keys are **names-only** in the repo
(`ANTHROPIC_API_KEY` in the host env).

**Conversational director — chat flow (2026-07-16).** On top of the one-shot planner, the director
is now **conversational**: `POST /v1/director/chat` takes the whole conversation + length/tier and
returns a `DirectorTurn` (a chat `reply`, an evolving `Screenplay` draft, and a `ready` flag). Same
seam — `MockScenarioPlanner.converse` runs offline today (re-plans from the dialogue, flips to
`ready` on approval words EN/KO or after a few turns); `ClaudeScenarioPlanner.converse` uses
`messages.parse` → `DirectorTurn` structured output so Claude replies in the user's language while
drafting the screenplay. App side: a **chat modal** (`src/app/director.tsx`, opened from Create's
"AI 감독과 대화하며 만들기" card) shows message bubbles, a live screenplay-draft card (title/logline/
scene list), and a **Generate this film** button that creates a job from the approved draft. Types
mirror the server in `src/api/types.ts`. Tested: director `pytest` (converse + endpoint), app tsc +
export clean.

**Free local-LLM director (2026-07-16).** So the real (non-mock) director can run **without a paid
API key**, a third planner backend `local` (`MAYO_PLANNER_BACKEND=local`) drives an **Ollama** LLM
on the mini: `LocalScenarioPlanner` POSTs to `MAYO_LOCAL_LLM_URL` (default `:11434`) with the
Pydantic JSON schema in Ollama's `format` field, so a locally-pulled model (default `llama3.2:3b`,
or `qwen2.5:7b` for quality) returns the `Screenplay`/`DirectorTurn` as JSON. `converse()` degrades
gracefully if the server is down or a small model drifts off-schema. Uses `httpx` (light dep). Setup:
`brew install ollama && brew services start ollama && ollama pull llama3.2:3b`, then set the env and
restart. The three director backends — **mock** (free/fake) · **local** (free/real, Ollama) ·
**claude** (paid/best) — are one config flip apart.

**Real local VIDEO generation ([[0009-mayo-local-video-generation-comfyui]], 2026-07-16).** The
generation seam ([[0007-mayo-model-provider-abstraction]]) now has a real **local** backend:
**ComfyUI + AnimateLCM** runs on the mini as a 5th launchd agent
(`com.efforthye.mayo.comfy`, `scripts/mayo-comfy-run.sh`, 127.0.0.1:8188). `ComfyUIModelBackend`
renders each scene (workflow file `workflows/animatelcm_t2v.json`, ~6 min/clip on the M1), the worker
**stitches clips with ffmpeg** into one film, and it's served (`GET /v1/media/{key}`, Range-enabled)
and **played in-app with expo-video**. Generation mode (mock ⇄ comfy) is an in-app toggle
(`/v1/settings`, `runtime.py`). Per-scene prompts come from the director's screenplay. Speed levers:
`MAYO_COMFY_WIDTH/HEIGHT/FRAMES/STEPS`.

**App feature set (shipped 2026-07-16).** Beyond Create/Jobs/Library/Account:
- **Explore tab** (leftmost) — `GET /v1/explore` feed, like + "make like this" (remix → Create prefill).
- **Video editor** — `POST /v1/edit` (`compose.py`): pick Library clips, reorder + trim, ffmpeg
  concat → new film. App modal `edit.tsx`.
- **Download** — film → `expo-file-system` + share sheet (`expo-sharing`).
- **Notifications** — local notification on job done/failed (`expo-notifications`, `JobNotifier`).
- **Live status** — pull-to-refresh (shared `Screen`), Library poll + focus-refetch, Jobs
  "in progress: N" + status dots; Job **retry** (`POST /v1/jobs/{id}/retry`) and video **delete**
  (`DELETE /v1/library/videos/{id}`) are real.
- **Auto-import** — startup scan of ComfyUI output → Library, so any generated clip is viewable.
- **Per-plan storage quota** — free 300 MB / pro 5 GB / studio 50 GB, metered against real usage.
- **No mock content** — seed videos/jobs removed; Library/Jobs show only real generated/imported/
  edited items.

🔜 Planned (requested, not yet built): **BYOK** — users with their own Higgsfield/Claude API key use
it and pay ~10% (own compute); real external video/image APIs wired per their docs behind the
`ModelBackend` seam.

**API authentication (2026-07-16).** The repo is public, so the API must not be wide open. All data
routers (catalog / jobs / library / billing) now require a **shared bearer key**
(`app/security.py`, `require_api_key`): the client sends `Authorization: Bearer <key>` (also accepts
`X-API-Key`), compared with `secrets.compare_digest` against `MAYO_API_KEY`. `/health` stays open
(so the app's connectivity check works). CORS `allow_credentials` is disabled when origins are `*`.
The key is a **secret — never committed**: set `MAYO_API_KEY` on the mini (e.g. `openssl rand -hex
32`) and paste the same value into the app (**Account → API key**, stored via Settings/AsyncStorage,
sent by `src/api/client.ts`). **If `MAYO_API_KEY` is unset the API runs open** (dev fallback) and
startup logs a warning — so locking down production is: set the key on the mini + paste it in the app.

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
- Web approach: RN-Web shared codebase vs. separate web frontend for mayo.im.
- Payment/billing provider and pricing model (per-length? per-model-tier? credits?).
- Scenario→scenes→clips→stitch pipeline design and how models are abstracted behind the registry.
- First set of image/video models to integrate.
- YouTube publishing: OAuth2 app setup + handling the Data API upload quota (batching / quota
  increase request); design the pluggable "publisher" interface.
- **Resolved:** storage strategy — local-first, S3 later ([[0004-mayo-storage-local-then-s3]]).
- **Resolved:** host — the [[home-server]] M1 mini (the operator's "MacBook" = same machine).
- **Resolved:** backend stack — FastAPI orchestration API ([[0005-mayo-backend-fastapi]]).
- **Resolved:** job queue — in-process asyncio first, Redis workers later ([[0006-mayo-job-queue-inprocess-then-redis]]).
- **Resolved:** generation-model abstraction — `ModelBackend` seam ([[0007-mayo-model-provider-abstraction]]).
- **Resolved:** scenario/director step — Claude scenario-planner seam, selectable director model
  ([[0008-mayo-ai-director-scenario-planner]]). Still open: wiring the planner into the worker.

## Related
- Client decision: [[0003-expo-react-native-for-mobile-app]]
- Backend: [[0005-mayo-backend-fastapi]] · Queue: [[0006-mayo-job-queue-inprocess-then-redis]] ·
  Storage: [[0004-mayo-storage-local-then-s3]] · Generation seam: [[0007-mayo-model-provider-abstraction]] ·
  AI director: [[0008-mayo-ai-director-scenario-planner]]
- Dev loop: [[expo-dev-loop]] · Deploy API: [[deploy-mayo-api]] · Host: [[home-server]] · CI: [[jenkins]]
- Related app in repo: [[richclub]] (existing FastAPI + front — reference for stack)
