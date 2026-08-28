# Log

Append-only chronological record of wiki activity. Each entry starts with a consistent prefix
so recent activity is greppable: `grep "^## \[" log.md | tail -5`.

Format: `## [YYYY-MM-DD] <op> | <summary>` where `<op>` is one of
`service`, `deploy`, `decision`, `incident`, `ingest`, `query`, `lint`, `setup`.

---

## [2026-07-15] setup | Initialized LLM Wiki structure, schema (CLAUDE.md), index, and overview
## [2026-07-15] setup | Specialized wiki for dev/deploy/ops: services, infra, runbooks, decisions, incidents + secrets-safety rule
## [2026-07-15] decision | ADR 0001 — deploy via GitHub Actions + HOME_SERVER environment; documented home-server infra + deploy runbook
## [2026-07-15] infra | Confirmed: HOME_SERVER_SECRET = SSH login password; services run via Docker (compose). Updated infra/runbook/ADR
## [2026-07-15] ingest | docker ps from m1mini — host = Apple M1 Mac mini (arm64), home.efforthye.com. Documented running services: richclub (api+front) and jenkins
## [2026-07-15] decision | ADR 0002 — actual CI/CD is Jenkins + GitHub webhooks; supersedes ADR 0001 (GitHub Actions env set up but unused)
## [2026-07-15] ingest | Host specs + state from m1mini: M1 8-core / 16GB / 1TB (~771GB free) / macOS 15.4.1; up 138d, healthy; ~35GB reclaimable Docker images. home-server status → live
## [2026-07-15] decision | ADR 0003 — Expo/React Native for mobile app; dev loop on M1 mini + Expo Go. Added service (mobile-app, planned) + runbook (expo-dev-loop)
## [2026-07-15] setup | Adopt workspace model: in-house apps live in apps/<slug>/ inside this repo. Updated CLAUDE.md, .gitignore (node/expo artifacts), added apps/README
## [2026-07-15] query | How to operate the home server from the phone via Claude → runbook claude-remote-control (Remote Control on the mini + phone app; SSH fallback). Web sandbox confirmed unable to reach the server.
## [2026-07-15] service | Defined mayo — premium AI long-form video generation platform (Expo app + mayo.im web). Replaced mobile-app placeholder; captured vision, features, architecture sketch, open decisions
## [2026-07-15] decision | ADR 0004 — mayo storage: local filesystem first, S3 when past ~half host disk; abstract storage behind local/s3 interface from day one
## [2026-07-15] service | mayo app shell scaffolded in apps/mayo (Expo SDK 57 / RN 0.86 / TS). 4 tabs Create/Jobs/Library/Account with mock data; typechecks clean. status → building
## [2026-07-15] service | mayo: confirmed host = M1 mini (the "MacBook" is the same machine); added YouTube-publish feature (Data API v3 OAuth2, pluggable publisher) to plan
## [2026-07-15] setup | Dev auto-sync for mayo: scripts/dev-autopull.sh (poll git pull) + runbook mayo-dev-autosync (tunnel for cellular; webhook option documented)
## [2026-07-15] service | mayo: downgraded Expo SDK 57 → 56 (App Store Expo Go didn't support 57); pinned RN 0.85.3/reanimated 4.3.1 etc., trimmed 57-only template extras. tsc + expo export both pass
## [2026-07-15] service | mayo: SDK 56 also rejected by installed Expo Go (confirmed serving 56) → downgraded further to SDK 55 (RN 0.83.10); removed expo-router ThemeProvider (not in SDK55). tsc + expo export pass. If 55 fails too → dev build.
## [2026-07-15] service | mayo: DIAGNOSED root cause — App Store Expo Go supports only SDK 54 (SDK 55/57 Expo Go stuck in Apple review), so 55/56/57 all failed. Pinned to SDK 54 (RN 0.81.5, expo-router 6.0.24); fixed use-theme for RN 0.81. tsc + expo export pass.
## [2026-07-15] service | MILESTONE — mayo running on physical iPhone via Expo Go (SDK 54) over tunnel. Create screen renders fully (prompt, length/quality chips, 140-credit estimate, 4 tabs). Live dev loop working. Added @expo/ngrok dep (tunnel).
## [2026-07-15] query | Explained Expo Go vs development build → concept page expo-go-vs-dev-build
## [2026-07-15] setup | mayo autostart: scripts/mayo-autostart-install.sh installs launchd agents (expo --tunnel + dev-autopull) that survive Termius close and reboot; runbook updated
## [2026-07-15] incident | launchd auto-pull failed "Operation not permitted" (exit 126) — repo was under ~/Desktop (macOS TCC blocks background agents). Fix: move repo out of Desktop. Runbook updated.
## [2026-07-16] setup | mayo autostart COMPLETE — moved repo out of ~/Desktop to ~/programs/... (TCC fix); both launchd agents (expo --tunnel + autopull) now run with PIDs. Full hands-off dev loop: push -> mini auto-pulls -> phone Fast-Refresh.
## [2026-07-16] setup | Live-reload loop PROVEN end-to-end (cloud edit -> push -> mini autopull -> phone Fast-Refresh). Documented reboot nuance: enable-autologin.sh must run BEFORE a reboot (gui-domain agents need a GUI session; SSH alone cannot revive them).
## [2026-07-16] service | mayo: added dark/light theme toggle + i18n (en/ko), persisted via AsyncStorage; Account has Appearance & Language pickers; flexible Length (10s..1hr+ + custom). dev-autopull now restarts expo agent on dep changes. tsc + expo export pass.
## [2026-07-16] setup | dev-autopull self-updates: restarts expo on dep changes AND restarts itself when dev-autopull.sh changes. After a one-time bootstrap restart, new libraries + autopull improvements apply with zero manual steps.
## [2026-07-16] service | mayo: refactored router to root Stack over (tabs) group; added Video Detail screen (library/[id]) with spec sheet + actions, and a YouTube Publish modal (title/description/visibility/quota note). Library cards tap through to detail. i18n keys (detail.*/publish.*/vis.*) in en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: Generate flow wired end-to-end — in-memory jobs store (JobsProvider/useJobs); Create adds a real queued job (title from prompt, scenes from length) and pushes to a new Job Detail screen (jobs/[id]) with status/progress/scene-dot-map/actions. Jobs tab reads live from the store and taps through. i18n (jobDetail.*) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: Extend Retention modal (extend.tsx) — current-expiry line + retention plans (+7d/+30d/indefinite) with per-plan credit cost from RETENTION_PLANS; wired from Video Detail's extend action. i18n (extend.*) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: default model tier is now a real persisted preference — added defaultTierId to Settings (AsyncStorage), Account has an inline model picker (replaces the inert chevron row), and Create initializes its tier from the saved default. i18n (account.defaultModelHint) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: Plans & billing modal (plan.tsx) — Free/Pro/Studio tiers from PLANS with price + tagline, current plan highlighted, Choose-plan CTA; opened from the Account plan card and the (now functional) Billing row. i18n (plan.*) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: app-wide toast (ToastProvider/useToast) — animated confirmation banner; wired to publish/extend/plan modals so mock actions confirm instead of dismissing silently. i18n (toast.*) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: Create screen example prompts — tappable starter chips (short label fills the full localized prompt) covering short film / long doc / teaser / noir. i18n (create.example.*) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo: job cancel/delete — removeJob in the jobs store; Job Detail has a destructive action (Cancel for active jobs, Delete otherwise) with a native confirm dialog + toast. i18n (jobDetail cancel/delete/confirm, toast.job*) en+ko. tsc + expo export pass.
## [2026-07-16] decision | ADR 0005 (mayo backend = FastAPI orchestration API) + ADR 0006 (job queue: in-process asyncio first, Redis workers later). Resolves the mayo backend-stack + queue open decisions.
## [2026-07-16] service | mayo-api Phase 1 scaffolded — FastAPI orchestration API at apps/mayo-api/ (jobs/library/catalog/publish/extend endpoints, in-process async mock generation worker, storage interface local+s3-stub, pluggable model registry, Dockerfile, env config). pytest 7/7 pass. Not yet wired to app or deployed. Runbook: deploy-mayo-api.
## [2026-07-16] setup | mayo-api deploy on mini — added launchd agent com.efforthye.mayo.api (scripts/mayo-api-run.sh: self-bootstrapping venv → uvicorn on :8001, richclub owns :8000) to mayo-autostart-install.sh; dev-autopull now restarts the API agent on apps/mayo-api/** changes. Hands-off: push → mini pulls → API restarts. Runbook deploy-mayo-api updated (launchd path A + Docker path B). Bash -n clean.
## [2026-07-16] service | mayo app wired to mayo-api — removed client mocks/store; added src/api (client + types + catalog fallback) and a useQuery hook. Create POSTs jobs; Jobs/Job-detail poll live progress; Library/detail/extend/publish read+write the API; catalog fetched with bundled fallback; loading/error/retry states everywhere. EXPO_PUBLIC_MAYO_API_URL config (default :8001); app.json ATS allows http for dev builds. tsc + expo export pass.
## [2026-07-16] service | mayo payments scaffold (app-native IAP) — PaymentProvider interface + mock provider + PaymentsProvider/usePayments (entitlement persisted via AsyncStorage); Plan modal drives purchase/restore, Account shows live entitlement. Real provider (RevenueCat/react-native-iap) slots into provider.ts in a dev build, gated on EXPO_PUBLIC_PAYMENTS. Backend seam added: /v1/billing/products + /v1/billing/validate stub. app tsc+export pass; api pytest 8/8.
## [2026-07-16] setup | mayo-api runner hardened — mayo-api-run.sh now uses the venv python directly (no activate sourcing), rebuilds a broken venv, and logs each step to mayo-api.log; dev-autopull also restarts the API agent when the runner changes. Fixes silent no-start (empty localhost:8001/health).
## [2026-07-16] decision | ADR 0007 — model calls behind a ModelBackend seam (app/providers.py): mock backend (default) vs external (real image/video providers), selected by MAYO_GENERATION_BACKEND. Worker drives generation per-scene via the backend.
## [2026-07-16] service | mayo-api generation-provider scaffold — app/providers.py (ModelBackend: MockModelBackend + ExternalModelBackend stub) + config MAYO_GENERATION_BACKEND; worker.py refactored to render each scene via the backend (fails the job if a scene errors). Real image/video models slot in behind the interface with keys later. pytest 11/11.
## [2026-07-16] service | mayo app: API status indicator in Account — polls /health and shows Server Connected/Offline + the API host, so connectivity is visible from the phone without a terminal. tsc + expo export pass.
## [2026-07-16] incident | mayo-api wouldn't start on the mini — Homebrew python3 is 3.14.4 and pinned pydantic 2.10.4 had no cp314 wheel → pydantic-core source build failed (PyO3 0.22.6 < 3.14), uvicorn never came up (empty localhost:8001/health). Diagnosed from mayo-api.log (hardened runner's logging). Fix: loosen requirements to 3.14-wheel versions (pydantic>=2.11 → 2.13.4, plain uvicorn without [standard]), runner exports PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 as fallback. Local install+tests pass (fastapi 0.139, uvicorn 0.51, pydantic 2.13.4; 11/11).
## [2026-07-16] service | mayo phone-anywhere reachability — app API base URL now runtime-configurable (Account → Server field, persisted via Settings/AsyncStorage; base-url.ts + client reads it live, health re-checks on change). Mini gets a public HTTPS URL via a Cloudflare quick-tunnel launchd agent (com.efforthye.mayo.tunnel / scripts/mayo-tunnel-run.sh, auto-installs cloudflared); paste the trycloudflare URL into the app to connect from office/5G. Installer now manages 4 agents; autopull restarts tunnel on script change. app tsc+export pass. (Quick-tunnel URL is ephemeral; named tunnel = follow-up.)
## [2026-07-16] service | mayo stable public API — reworked tunnel to a NAMED Cloudflare tunnel (mayo-api.efforthye.dev -> localhost:8001), reusing the existing cloudflared login (cert.pem, efforthye.dev zone from richclub). scripts/mayo-tunnel-run.sh self-provisions (creates tunnel + DNS route + dedicated ~/.cloudflared/mayo-api.yml, never touches richclub config.yml) then serves it. App now defaults to https://mayo-api.efforthye.dev (no pasting); still overridable in Account → Server. autopull restarts tunnel agent on script change. Runbook updated. app tsc+export pass.
## [2026-07-16] decision | ADR 0008 — AI director: a Claude scenario-planner seam in front of generation (app/planner.py). prompt+length → typed Screenplay (title/logline/style/scenes); MockScenarioPlanner (default, offline) vs ClaudeScenarioPlanner (messages.parse → Screenplay structured output, adaptive thinking). Director model user-selectable (GET /v1/catalog/directors: Opus 4.8/Sonnet 5/Haiku 4.5) via MAYO_DIRECTOR_MODEL. Optional anthropic dep (requirements-ai.txt, lazy-imported). Not yet wired into worker (documented follow-up).
## [2026-07-16] service | mayo-api API authentication — public repo can't expose open endpoints. app/security.py require_api_key: all data routers (catalog/jobs/library/billing) require Authorization: Bearer <MAYO_API_KEY> (or X-API-Key), secrets.compare_digest; /health stays open; CORS allow_credentials off when origins=*. Key unset → open (dev) + startup warning. App: src/api/api-key.ts + Account → API key field (persisted via Settings), client sends the bearer header. Secret is names-only in repo. pytest 20/20; app tsc + expo export pass. ACTION NEEDED: set MAYO_API_KEY on the mini + paste same key in the app to lock down.
## [2026-07-16] setup | mayo-api-run.sh now sources git-ignored apps/mayo-api/.env (set -a) before uvicorn — fixes MAYO_API_KEY (and other .env vars) never being picked up on the mini (runner only read the process env; nothing loaded .env). Secret stays host-only/never committed; log reports set/unset, not the value. autopull already restarts the API agent on runner changes. bash -n clean.
## [2026-07-16] service | mayo conversational AI director ("대화형 영상생성 플로우") — POST /v1/director/chat: sends the whole conversation + length/tier, returns DirectorTurn (chat reply + evolving Screenplay draft + ready flag). Same planner seam (ADR 0008): MockScenarioPlanner.converse runs offline (re-plans from dialogue, ready on approval words EN/KO or 3+ turns); ClaudeScenarioPlanner.converse uses messages.parse -> DirectorTurn structured output. App: chat modal src/app/director.tsx (opened from a Create card) with bubbles + live screenplay-draft card + "Generate this film" (creates a job from the approved draft); api client directorChat + types. Endpoint auth-protected. pytest 24/24; app tsc + expo export pass.
## [2026-07-16] service | mayo-api free local-LLM director — third planner backend `local` (MAYO_PLANNER_BACKEND=local, ADR 0008): LocalScenarioPlanner talks to an Ollama server (MAYO_LOCAL_LLM_URL default :11434) via its JSON-schema `format` field so a locally-pulled model (default llama3.2:3b) returns Screenplay/DirectorTurn as JSON — real AI director with NO paid key. converse() degrades gracefully if the server is down / model drifts off-schema. Added httpx to requirements (pure-Python, 3.14-safe) + local_llm_* config + .env.example docs. pytest 26/26. Setup: brew install ollama; ollama pull llama3.2:3b; set env; restart.
## [2026-07-16] incident | mayo director chat unusable on phone — (1) keyboard covered the input (KeyboardAvoidingView offset is wrong inside a modal) → replaced with manual Keyboard-height padding (director.tsx) so the input always sits above the keyboard; (2) first local-LLM turn timed out (iOS 60s request timeout) while the model cold-loaded → warm the model on API startup (main.py lifespan) + keep_alive=30m + num_predict cap on the Ollama call so it stays resident between turns. app tsc + expo export pass; api pytest 26/26.
## [2026-07-16] service | mayo local director latency fix — LocalScenarioPlanner now uses Ollama's lightweight JSON mode (format="json") + prompt-described shape + lenient parse, instead of full nested-schema constrained decoding which overran the phone's 60s timeout on small models (cause of repeated "couldn't reach the studio"). num_predict capped to 1200; keep_alive 30m + startup warm-up retained. pytest 26/26.
## [2026-07-16] setup | mayo local video generation — ComfyUI as a launchd service. Added scripts/mayo-comfy-run.sh (runs ComfyUI from ~/programs/ComfyUI venv, serves API on 127.0.0.1:8188) + com.efforthye.mayo.comfy agent in mayo-autostart-install.sh (5th agent) so ComfyUI survives Termius close / reboot; dev-autopull restarts it on runner change. Next: ComfyUIModelBackend (scene prompt -> clip via ComfyUI API) + ffmpeg stitch + app playback.
## [2026-07-16] service | mayo-api ComfyUIModelBackend — real LOCAL video generation wired behind the ModelBackend seam (MAYO_GENERATION_BACKEND=comfy). Per scene: load workflows/animatelcm_t2v.json, inject the scene prompt + per-scene seed, POST to ComfyUI /prompt, poll /history until the clip renders, download via /view, store via the storage interface. Confirmed end-to-end via comfy-smoke.sh (first local AnimateLCM clip: 362s on the M1). Config: comfy_url/workflow/poll/max_wait. Default stays mock (worker stitch + serving + app playback next). pytest 28/28.
## [2026-07-16] service | mayo end-to-end local video — worker now collects per-scene clips and STITCHES them with ffmpeg into one film (app/worker.py, storage-agnostic via storage.read()), stores it, and LibraryStore records the film's playback url. New GET /v1/media/{key} route serves stored media (path-traversal guarded, auth-protected). Video schema + app types gain `url`. App: library detail plays the real film via expo-video (VideoView, API key passed as header) when url present, else the placeholder poster. Backend pytest 28/28; app tsc + expo export pass (expo-video 3.0.16). Mock stays default; enabling = MAYO_GENERATION_BACKEND=comfy + ffmpeg on the mini.
## [2026-07-16] service | mayo generation controls moved app-side + per-scene prompts + speed knobs. runtime.py holds an app-switchable generation backend (persisted to .runtime.json) so mock<->comfy flips from the app, not .env; GET/PUT /v1/settings expose it; worker resolves the backend per job. Per-scene director prompts: CreateJobRequest.scenePrompts + Job.scenePrompts; scene count follows the screenplay; worker renders scene i from scenePrompts[i] (falls back to title). Speed levers MAYO_COMFY_WIDTH/HEIGHT/FRAMES/STEPS (steps default 8->6) injected into the workflow. pytest 30/30.
## [2026-07-16] service | mayo app: generation-mode toggle in Account (빠름/미리보기 = mock vs 로컬 AI = comfy) via /v1/settings — flip real local generation from the app, no .env. Director "Generate" now sends per-scene scenePrompts from the screenplay so each scene renders its own shot. i18n (account.generation/gen*) en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo Explorer tab — new leftmost tab (탐색): public feed of trending community creations (GET /v1/explore, seeded, sorted by likes) with like (POST /v1/explore/{id}/like) and "이렇게 만들기" remix that opens Create prefilled (seed param). Backend schemas.ExploreItem + ExploreStore; app explore.tsx + client + types + i18n en/ko. pytest 33/33; app tsc + expo export pass.
## [2026-07-16] service | mayo auto-import + live refresh. Backend importer.py scans MAYO_IMPORT_DIR (default ~/programs/ComfyUI/output) on startup and imports new *.mp4 into the Library (deduped via .imported.json) — so clips generated even via the smoke test are viewable in-app; LibraryStore.add_imported + Video url. App: shared Screen gains pull-to-refresh (RefreshControl); Library polls 15s + refetches on focus; Jobs shows an "진행 중 N개" active-sessions bar, sorts active first, and a per-card status dot (green/red). i18n jobs.activeCount. pytest 33/33; app tsc + expo export pass.
## [2026-07-16] service | mayo video download — Library detail "영상 다운로드" downloads the film from /v1/media (with API key header) via expo-file-system and opens the share sheet (expo-sharing) to save to device/Photos/Files. Guards when no real file (mock) with a helpful toast; per-clip export shows "곧 지원". Deps expo-file-system + expo-sharing. i18n detail.download*/noFile/clipsSoon en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo completion notifications — app-wide JobNotifier (mounted in root layout) polls jobs and fires a LOCAL notification (expo-notifications) when a job transitions to done/failed, requesting permission on first run. Note: Expo Go supports local notifications only; background/killed-app push needs a dev build later. i18n notify.done/failTitle en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo real-content pass + simple editor. Removed mock seed videos/jobs (v1-v3, j1-j4) — they had no playable file and confused the Library ("영상 #3 안 재생"); Library/Jobs now show only real generated/imported/edited content. Storage usage is now REAL (sum of stored bytes vs 50GB cap). Simple video editor: POST /v1/edit (schemas EditClip/EditRequest, compose.py trims each source clip with ffmpeg -ss/-t and concats, LibraryStore.add_film). App: edit.tsx modal (pick your videos -> reorder ▲▼ -> per-clip trim start/end -> export), opened from a "영상 편집" entry in Library; client createEdit + types + i18n en/ko. pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo real delete + retry. DELETE /v1/library/videos/{id} removes the video + its stored file (LibraryStore.remove); app video detail gets a trash action (confirm dialog). POST /v1/jobs/{id}/retry re-queues a failed job and re-runs generation (JobStore.retry); Job detail's Retry now actually re-runs (was a no-op back()). i18n detail.delete*/common.cancel/jobDetail.retrying en+ko. pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo per-plan storage quota — Plan.storageMb (free 300MB / pro 5GB / studio 50GB) + Storage.usedBytes (real). App meters real usage against the current plan's cap in the Library storage bar, showing "거의 가득 — 업그레이드" (→ plan modal) when ≥85% full. catalog.planStorageBytes/formatBytes helpers. pytest 36/36; app tsc + expo export pass.
## [2026-07-16] decision | ADR 0009 — real local video generation via ComfyUI + AnimateLCM behind the ModelBackend seam (ffmpeg stitch, served + played in-app, in-app mock⇄comfy toggle). Wiki refresh: mayo.md now documents local video gen + the full app feature set (Explore/editor/download/notifications/live-status/delete/retry/auto-import/storage quota) + planned BYOK; index.md registers ADR 0009.
## [2026-07-16] service | mayo Explore is REAL now — removed the dummy seed; the feed shows only user-published creations. POST /v1/explore publishes a real (playable) Library video (author @me, likes 0, url); GET /v1/explore?sort=popular|latest; POST .../like. App: Explore has 인기/최신 sort toggle, an empty state ("아직 공개된 영상이 없어요 — 만들고 '탐색에 공개'"), cards tap to a play screen (explore/[id], expo-video) with like + remix; Library detail gets "탐색에 공개". i18n en+ko. pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo BYOK pricing seam — runtime.byok + /v1/settings byok toggle; /v1/jobs/estimate applies a 0.1 price factor when BYOK on. App: Account BYOK toggle (사용 안 함 / 내 키 사용 10%) + Create's cost estimate reflects it. Real per-provider key usage + external API (Higgsfield etc.) connection is the documented follow-up (needs provider docs/keys). i18n en+ko. pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo download → saves to the device Photos album (expo-media-library saveToLibraryAsync, requests permission) instead of only the share sheet; falls back to share/toast if permission denied. i18n detail.savedToAlbum en+ko. tsc + expo export pass. (Note: generated LOCAL-AI videos already appear in the Library via worker add_from_job + auto-import; mock videos appear but have no playable file.)
## [2026-07-16] service | mayo Explore "좋아요" collection — local favorites (FavoritesProvider, AsyncStorage 'mayo.favorites.v1'); the heart on Explore cards/detail toggles a device-local favorite (also increments the server like). Explore gets a 3rd mode chip "좋아요" showing your liked videos with an empty state. App-only (no accounts yet). i18n explore.liked/likedEmpty* en+ko. tsc + expo export pass.
## [2026-07-16] service | mayo Explore autoplay + notification settings. Account gains "탐색 자동재생" (끔=데이터 절약 / 켬) and "완성 알림" (끔/켬) toggles, persisted in Settings. When autoplay is on, Explore feed cards play a muted looping preview inline (expo-video); off = poster + tap→detail (saves data). JobNotifier respects the notify toggle. tsc + expo export pass.
## [2026-07-16] service | mayo Explore → reels (TikTok/Reels-style). Tapping an Explore card opens a full-screen vertical swipe player (app/reels.tsx): swipe up/down for next/prev, only the active clip plays; per-video overlay with like, comments, follow, and "이 템플릿 활용해보기"(remix). Remix removed from the feed cards (detail-only, per request). Comments backend: ExploreComment + GET/POST /v1/explore/{id}/comments + item.comments count. Local follow store (FollowsProvider, AsyncStorage). Old explore/[id] detail removed. i18n reels.* en+ko. pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo live scene preview + real duration. Worker now exposes each rendered clip on the job (Job.sceneUrls, appended as scenes finish) so the Job detail shows a live "미리보기 (지금까지 만든 씬)" horizontal strip of the completed clips while still generating. Duration bug fixed: the library video's durationLabel is now the REAL stitched length (rendered clips × clip-seconds = comfy_frames/comfy_fps), not the requested seconds — so a 1-scene local clip reads 0:02, not 0:10. Added comfy_fps config (injected into the VHS frame_rate). pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo duration-accurate generation + like dedup. (1) A job now renders enough fixed-length clips to FILL the requested length (clips_for_duration = ceil(seconds / (comfy_frames/comfy_fps)), capped at MAYO_MAX_SCENES=60); director scenes are cycled to reach the length too. So "10초" → 5 clips → ~10s film. (2) Like is one-per-device and toggleable: added POST /v1/explore/{id}/unlike (decrement, clamped); favorites.toggle calls like/unlike; removed the double-count (+1) display so the count is server-truth (feed refetches after toggle). pytest 36/36; app tsc + expo export pass.
## [2026-07-16] service | mayo AI 감독 모델선택 + 한국어 품질개선. (1) 감독 백엔드(mock|local|claude)와 모델이 앱에서 런타임 전환 가능 — runtime.py에 planner_backend/director_model 추가·영속화, GET/PUT /v1/settings에 plannerBackend·directorModel(검증: 미지원 모델→400), get_scenario_planner()가 런타임값을 읽음. (2) 감독 화면 헤더에 모델 피커(바텀시트, GET /v1/catalog/directors 기반: 기본/로컬 LLM/Claude 각 모델). (3) 한국어 품질: 스크린샷의 "말 되풀이·중국어 섞임"은 로컬 3B 모델 한계 — 실질 해법은 Claude 선택. 프롬프트 강화(사용자 언어로 답·에코 금지·초안 우선), mock 감독과 모든 오류 폴백이 한국어 입력 시 한국어로 응답. Claude 경로는 키/패키지 없을 때 500 대신 안내 메시지로 degrade. pytest 38/38; 앱 tsc + expo export 통과.
## [2026-07-16] decision | mayo ADR 0010 — 외부 유료 생성 프로바이더 연동 (Nano Banana + Higgsfield). ExternalModelBackend 실구현(generation_backend=external, 앱 Account에서 '외부 API'로 런타임 전환): 씬마다 (1) Nano Banana = Google Gemini 2.5 Flash Image REST(generateContent, x-goog-api-key, candidates[].content.parts[].inlineData.data base64 디코드)로 스틸 생성(옵션), (2) Higgsfield 공식 SDK(higgsfield-client, HF_KEY)로 submit→폴링→완료 URL 다운로드로 영상화, 스토리지 seam에 저장. 프로바이더 스키마(모델 id·인자 키·화면비·폴링)는 env 설정("로우코드")이라 코드수정 없이 모델 교체 가능. 키는 이름만 리포에(.env.example), 값은 호스트 시크릿. 호스트=사용자 서버라 사실상 BYOK(10% 요금). 테스트: Nano Banana REST 파싱/키검증/외부백엔드 선택 유닛테스트 추가(pytest 40/40), 앱 tsc + export 통과. Account 생성방식에 '외부 API' 칩 추가 + putSettings가 항상 planner 필드 보존(감독 설정 리셋 방지). 위키: 0010 ADR + mayo 서비스페이지 갱신.
## [2026-07-16] service | mayo 웹 타깃 추가 (mayo.im). 같은 Expo 코드베이스가 웹으로도 빌드됨(react-native-web + expo-router). app.json web.output를 static→single로 변경(static은 resetServerContext에서 크래시; single=클라이언트 SPA). npm run build:web(expo export -p web)→dist/, apps/mayo/vercel.json 추가(SPA rewrite, Root Directory=apps/mayo). 네이티브 전용 모듈 웹 가드: expo-notifications(job-notifier 웹 스킵), media-library/file-system/sharing(library 상세 다운로드는 웹에서 브라우저 <a download>로 폴백), Alert.alert 웹 무동작→삭제확인은 window.confirm. API base는 기본 Cloudflare 터널(mayo-api.efforthye.dev)이라 웹에서 바로 연결. ⚠️ 공개 웹 번들에 공유 API 키를 굽지 말 것(유출)→공개 mayo.im은 계정 도입 전까지 데모/읽기중심 권장. iOS + web export 모두 통과, tsc 통과. 위키: concepts/mayo-web-target + 서비스페이지 + index 갱신.
## [2026-07-16] service | mayo 가로 편집기 (키네마스터/캡컷 스타일). 편집 화면 진입 시 가로로 회전(expo-screen-orientation@9.0.9 lockAsync LANDSCAPE, 나갈 때 PORTRAIT 복원; 웹은 no-op). 좌측 미리보기 플레이어 + 우측 인스펙터 + 하단 타임라인 필름스트립 레이아웃. 기능: 클립 추가(소스 피커 시트)/선택/순서이동/분할(split=트림 중점 기준 2개로)/복제/삭제/트림(시작·끝 ±1s 스테퍼)/클립별 자막(텍스트+위치 상/중/하). 백엔드 compose.py가 EditClip.text/textPosition 받아 ffmpeg drawtext로 번인(폰트 없거나 실패 시 자동으로 자막 없이 재렌더 — 렌더 절대 안 깨짐), MAYO_EDIT_FONT 설정(기본 AppleSDGothicNeo, 한글 지원). edit 라우트 fullScreenModal로 변경. 오디오/음성 트랙은 다음 배치. 테스트: drawtext 이스케이프/위치 유닛테스트(pytest 42/42), 앱 tsc + iOS/web export 통과.
## [2026-07-16] decision | mayo ADR 0011 — 계정 + SNS 로그인. 백엔드: app/auth.py(유저·세션을 media/.users.json에 영속 — gitignored, 비밀번호 scrypt+솔트, 30일 불투명 세션토큰), /v1/auth register|login|google|me|logout, 세션은 X-Mayo-Session 헤더(공유 API키의 Authorization과 분리). Google 로그인: 앱이 expo-auth-session으로 id_token을 받아 POST → 서버가 Google tokeninfo로 검증 + aud를 GOOGLE_OAUTH_CLIENT_IDS와 대조, 최초 로그인 시 자동가입(이메일 기준이라 이메일 계정과 병합). 앱: AuthProvider(토큰 영속+기동시 me 재검증), /login 모달(이메일/비번 + 가입 전환 + Google 버튼은 EXPO_PUBLIC_GOOGLE_CLIENT_ID 설정 시 노출), Account 상단 프로필/로그인 카드, i18n en+ko. 의존성: expo-auth-session/web-browser/crypto (SDK54 핀). 테스트: 가입/로그인/me/로그아웃 왕복, 중복 409, 오답 401, 검증 422, google 미설정 401/aud 불일치(pytest 46/46). 앱 tsc + iOS/web export 통과. 남은 후속: 좋아요·팔로우 계정 스코프 이전, Apple/Kakao, 비번재설정. 위키: 0011 ADR + index.
## [2026-07-16] decision | mayo ADR 0012 — 실결제: Stripe Checkout(웹) 우선. 백엔드 app/stripe_pay.py(SDK 없이 REST: form-encoded 세션 생성 + Stripe-Signature HMAC 수동검증, 5분 허용오차). POST /v1/billing/checkout(로그인 필수 — client_reference_id=유저id, 미설정시 명확한 400) → Stripe 호스티드 결제페이지 URL 반환; POST /v1/billing/stripe-webhook은 공유키 가드 없이 마운트(서명이 인증) — checkout.session.completed에서 해당 유저에 플랜 부여(users.set_plan → AuthUser.planId, /v1/auth/me에 반영). 앱: 플랜 화면에 "카드로 결제(웹)" 버튼(비로그인→로그인 모달, 로그인→expo-web-browser로 결제페이지), 모바일 IAP 목업은 dev build용 시드로 유지. 키 이름만 리포에(STRIPE_SECRET_KEY/WEBHOOK_SECRET/PRICE_PRO/STUDIO). 테스트: 비로그인 401, 미설정 400, 웹훅 서명불량·타임스탬프 만료 거부, 유효서명 플랜부여, 무관 이벤트 ack(pytest 49/49). 앱 tsc + iOS/web export 통과. 위키: 0012 ADR + index.
## [2026-07-16] service | mayo 유료 게이팅 + 오너 키 운용. MAYO_PREMIUM_GATING(기본 false) 도입: 켜면 Claude 감독(planner=claude)과 외부 유료 생성(generation=external)은 로그인 + 유료플랜(planId != free) 사용자만 사용 가능(익명/무료는 402 + 명확한 안내) — 오너가 등록한 ANTHROPIC_API_KEY/HF_KEY를 유료유저 전용 기능으로 파는 구조(ADR 0011 계정 + 0012 결제와 연결). 기본은 꺼져 있어 오너/데브 플로우는 그대로. ⚠️ 실제 키 값 2건(Anthropic, Higgsfield)은 채팅으로 전달받았으나 보안규칙대로 리포에 저장하지 않음 — 미니의 apps/mayo-api/.env(gitignored)에 넣는 명령을 오너에게 안내(아래 회신 참조), Anthropic 키는 채팅 노출이력이 있어 회전 권장. 테스트: 게이팅 off 허용/무료 402/유료 200/외부생성 402(pytest 52/52).
## [2026-07-16] incident | mayo Expo 터널 다운 (ERR_NGROK_3200). 원인: package.json을 바꾸는 푸시 연속 배치에서 dev-autopull이 npm install 도중/직후 kickstart로 expo를 재시작 → node_modules가 변경되는 중에 Metro 기동 → 크래시 루프 → ngrok 터널 소멸(404/3200). 조치(dev-autopull.sh, 자가업데이트로 배포): (1) sync_app_deps = bootout(완전정지) → npm install → 스탬프 기록 → bootstrap(깨끗한 재기동) 순서로 레이스 제거, (2) 기동 시 자가치유 — node_modules/.pkg-sha 스탬프가 package-lock 해시와 다르면 즉시 deps 동기화+expo 재기동(이번 장애도 이 경로로 자동복구). 터널 URL은 apps/mayo/.expo에 저장되어 재시작 후에도 동일.
## [2026-07-16] service | mayo 편집기 음성 트랙 (보이스오버). 편집기 인스펙터에 "음성 녹음" 추가(네이티브 전용): expo-audio(~1.1.1, SDK54 핀)로 기기에서 녹음 → 정지 시 POST /v1/edit/audio(raw body 업로드, 멀티파트 의존성 없음, 50MB 제한, content-type별 확장자)로 업로드 → 반환된 audioKey를 편집 내보내기에 첨부. 백엔드 compose가 EditRequest.audioKey를 받아 스티칭된 컷 위에 ffmpeg로 먹싱(-map 0:v -map 1:a -c:a aac -shortest) — 오디오가 깨져도 편집이 실패하지 않게 실패 시 무음 컷으로 폴백. app.json에 expo-audio 플러그인(마이크 권한 문구, dev build 대비). 재녹음/제거 가능("음성 트랙 적용됨 ×"). i18n en+ko. 테스트: 오디오 업로드 왕복+빈 업로드 400(pytest 53/53); 앱 tsc + iOS/web export 통과.
## [2026-07-16] service | mayo 유저별 BYOK 키 (실사용). 계정에 프로바이더 키 저장: PUT/GET /v1/auth/me/keys (anthropic/gemini/higgsfield; 빈값=삭제, 조회는 항상 마스킹 "…끝4자리" — 원본은 절대 응답에 안 나감, gitignored .users.json 보관). 실사용 연결: (1) Claude 감독 — 로그인 유저가 자기 anthropic 키를 저장했으면 감독 대화가 그 유저 키로 실행(AsyncAnthropic(api_key=...)), 유료 게이팅도 자기 키 보유 시 통과. (2) 가격 — /v1/jobs/estimate가 세션 유저의 키 보유 여부를 보고 그 유저에게만 BYOK 0.1 배율 적용(글로벌 토글과 독립). 앱: Account BYOK 섹션에 로그인 시 "내 키" 카드(Anthropic/Higgsfield 입력, secure, 저장된 키는 마스킹 표시). planner.converse에 api_key 파라미터(3구현 모두, mock/local은 무시). 남은 것: 외부 생성(worker)이 유저 키를 쓰려면 잡 생성 시 키 캡처 필요 — 후속. 테스트: 키 왕복/마스킹/삭제/미로그인 401/견적 14→1 크레딧(pytest 56/56); 앱 tsc + iOS/web export 통과.
## [2026-07-16] service | mayo 생성 UX — 정확한 예상시간 + 스피너 + 재시도. (1) 워커 ETA 수정: mock tick 기반(항상 ~1분)이던 계산을 실측 평균으로 — 잡 시작 시 백엔드별 기본값(comfy=MAYO_COMFY_CLIP_ETA_SECONDS 기본 240초/클립, external=90초, mock=tick)으로 etaMin을 즉시 세팅하고, 씬이 끝날 때마다 (경과시간/완료씬수)×남은씬으로 갱신 → 잡 상세의 "예상 ~N분"이 실제와 맞음. (2) 생성 버튼: 제출 중 ActivityIndicator + "시작하는 중…" 표시. (3) 잡 상세: 진행 중일 때 상태줄에 스피너(빙글빙글). (4) 일시적 네트워크 오류(터널/API 재시작 순간) 시 생성 요청 1회 자동 재시도(1.5초 후) — "서버에 연결하지 못했어요 → 다시 누르면 됨" 케이스 해소. pytest 56/56; tsc + iOS export 통과.
## [2026-07-16] incident+service | mayo 편집기 크래시 + 보관함 유실 수정. (1) 크래시: 가로 잠금 중 RN Modal(기본 세로 전용)을 열면 iOS가 "no common orientation" 예외로 앱 강제종료 — 편집기 소스피커 Modal에 supportedOrientations=[portrait,landscape] 추가. (2) 보관함 유실: LibraryStore 메타데이터가 메모리 전용이라 API 재시작(오늘 키 등록/배포로 다수)마다 목록이 사라짐(파일은 media/에 존재) — media/.library.json으로 영속화(기동 시 로드, add/remove/extend마다 저장; 임포터는 seen-레지스트리가 있어 중복 없음). pytest 56/56; tsc + iOS export 통과.
## [2026-07-16] service | mayo YouTube 실업로드. app/youtube.py(순수 REST): 유저별 OAuth — POST /v1/publish/youtube/connect가 구글 동의 URL 반환(일회용 state→유저 매핑, 10분 TTL), GET /v1/publish/youtube/callback(공유키 가드 없이 마운트 — 브라우저 리디렉션, state가 인증)이 code 교환 후 refresh token을 유저 레코드에 저장, GET /status로 연결여부 확인. 게시(/v1/library/videos/{id}/publish)가 연결된 유저면 스토리지에서 영상을 읽어 YouTube Data API v3 resumable upload(토큰 갱신→세션 시작→PUT 바이트) 실행, 실제 YouTube videoId 반환; 미연결/미설정이면 기존 스텁 유지(안 깨짐). 설정: MAYO_YOUTUBE_CLIENT_ID/SECRET/REDIRECT_URI(이름만 리포에; 값은 미니 .env 등록 완료, 같은 클라이언트로 GOOGLE_OAUTH_CLIENT_IDS=구글 로그인도 활성). 앱: 게시 화면에 "YouTube 연결하기" 배너(브라우저 동의→연결됨 표시), i18n en+ko. 테스트: connect 401/동의URL 형식/state 일회성/callback 400/status 연결여부(pytest 60/60); tsc + iOS/web export 통과. ⚠️ 시크릿 채팅 노출 → 안정화 후 재발급 권장.
## [2026-07-16] service | mayo 웹 인증 해결 — 공개 웹은 키 없이 배포. security.require_api_key가 유효한 로그인 세션(X-Mayo-Session)을 공유키와 동급 자격증명으로 인정하고, /v1/auth 라우터는 가드 없이 마운트(register/login/google은 자체 검증, me/logout/keys는 내부에서 세션 확인) — 웹 번들(검사 가능한 공개 JS)에 공유키를 굽지 않아도 로그인만 하면 전 기능 사용 가능. 테스트: 세션 통과/가짜 세션 401/키 없이 register 접근 가능(pytest 62/62). 남은 것: Vercel에서 mayo.im 프로젝트를 이 레포(Root=apps/mayo, Production Branch=작업 브랜치)로 연결(오너 대시보드 작업). concepts/mayo-web-target 갱신.
## [2026-07-16] deploy | mayo 웹 → Vercel(mayo.im) 연결. 오너가 Vercel 프로젝트(mayo-landing-page)를 이 레포로 전환: Production Branch=claude/claude-md-docs-adlc4w, Root Directory=apps/mayo, 도메인 www.mayo.im. 빌드는 apps/mayo/vercel.json(expo export -p web → dist, SPA rewrite)이 처리. 이 커밋이 첫 프로덕션 배포 트리거. 웹 인증은 세션 기반(공유키 미포함)이라 방문자는 로그인 후 사용.
## [2026-07-16] service | mayo 웹 401 UX. 키 없는 공개 웹에서 로그인 전 작업/보관함이 "서버에 연결하지 못했어요"로 떠 혼란 → ErrorBlock이 error를 받아 ApiError 401이면 "로그인하면 내 영상과 작업이 여기에 보여요" + 로그인 버튼(/login 이동)을 표시. jobs/library/explore 탭에 error 전달. i18n common.authNeeded en+ko. tsc + iOS/web export 통과. (참고: 이 시점부터 push가 Vercel mayo.im 자동 재배포도 트리거)
## [2026-07-16] service | mayo 유튜브 게시 링크 저장 + 연결 자동감지. (1) 첫 실업로드 성공(오너 확인) 후 요청: 업로드 결과 URL이 보이게 — 백엔드가 업로드 성공 시 Video.youtubeUrl(=https://youtu.be/<id>)을 라이브러리에 영속 저장하고 PublishResult.url로 반환; 앱은 게시 성공 시 유튜브 페이지를 바로 열고, 영상 상세에 "YouTube에서 보기" 버튼이 영구 표시. (2) 연결 감지: 승인은 별도 탭/시트에서 일어나 돌아와도 화면이 갱신 안 되던 문제 — 연결 대기 중 3초마다 상태 폴링(최대 2분)으로 자동 반영. pytest 62/62; tsc + iOS/web export 통과. (푸시가 Vercel mayo.im 자동 재배포)
## [2026-07-16] service | mayo status → live. 앱(Expo Go) + 웹(mayo.im, Vercel 자동배포) + API(미니 :8001 → mayo-api.efforthye.dev 터널) 전부 실사용 가동: 실제 로컬 AI 영상생성, Claude 감독(오너 키 인증 확인), 계정/로그인(웹 세션 인증), 실제 YouTube 업로드(첫 업로드 성공 + 링크 저장), 편집기(자막·음성), BYOK, Stripe 준비. index 레지스트리·서비스 페이지 status 갱신.
## [2026-07-16] service | mayo 웹 구글 로그인을 GIS로 교체. expo-auth-session 팝업 플로우가 브라우저에서 깨짐(팝업 안에 앱이 다시 뜨고 opener로 토큰 전달 실패 — 오너 재현) → 웹에서는 Google Identity Services(공식 gsi/client 스크립트, google.accounts.id.initialize + renderButton)로 구글이 직접 버튼을 렌더링하고 credential(id_token) 콜백을 받아 기존 /v1/auth/google로 전달. 네이티브는 기존 expo-auth-session 유지. 사전조건: 구글 콘솔 승인된 JavaScript 원본에 mayo.im/www.mayo.im (오너 등록 완료). tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 마이페이지 개편 + 알림함 + 설정 분리 (밤샘 배치 1). (1) 계정 탭 → "마이": 프로필/로그인 카드, 알림(미읽음 배지)·좋아요한 영상(개수, 릴스 liked 모드로)·내 영상·플랜·저장공간·설정/결제 rows로 정리. (2) 설정은 /settings 모달로 분리(화면모드·언어·기본모델·생성모드·BYOK+내키·자동재생·완성알림·서버/API키). (3) 인앱 알림함: InboxProvider(AsyncStorage mayo.inbox.v1, 100개 캡) — JobNotifier가 완료/실패를 항상 인박스에 적재(웹 포함; 시스템 알림은 네이티브+허용시), /notifications 화면(열면 전체 읽음, 모두 지우기, 상대시간). (4) 탐색에서 "좋아요" 칩 제거(피드는 인기/최신만) — 좋아요 모음은 마이로 이동. i18n my./inbox./settings.title en+ko, 탭명 계정→마이/My. tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 에디터 배속+색 필터 (밤샘 배치 2). EditClip에 speed(0.25~4x, ffmpeg setpts)와 filter(none|mono 흑백|warm|cool|vivid — hue/colorbalance/eq) 추가; per-클립 -vf 체인은 자막→배속→색 순서로 합성(_vf_chain, 실패 시 무필터 재렌더 폴백 유지). 편집기 인스펙터에 배속(0.5/1/1.5/2x)·필터 칩 추가, 타임라인의 클립 길이 표시는 배속 반영. 테스트: 체인 합성 순서/중립 클립 빈 체인/미지원 색 무시(pytest 63/63); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 플로우 다듬기 (밤샘 배치 3). (1) 유튜브 게시 성공이 알림함에 기록(업로드 링크 포함) — 나중에 마이 탭 알림에서 다시 확인 가능. (2) AI 감독 화면에서 길이(10s/30s/1m/3m)·품질(Draft/Standard/Premium)을 대화 도중 칩으로 즉시 변경 가능 — 이후 턴부터 감독이 새 설정 기준으로 각본을 다시 짬(이전엔 만들기 화면에서 정한 값 고정). tsc + iOS/web export 통과.
## [2026-07-17] incident | mayo 생성 모드가 mock으로 리셋 → "영상이 재생 안 됨". 오너가 생성한 영상이 목업(용량 —MB, 1080p 라벨, 재생 불가)으로 나옴 — 서버 generation_backend가 mock으로 돌아가 있었음. 원인: 설정/감독 화면이 서버 설정을 아직 못 불러온 상태(genSettings=null)에서 다른 토글을 누르면 폴백 기본값('mock')을 통째로 PUT 해버리는 레이스. 조치: settings.tsx의 chooseGen/chooseByok와 director 피커 choose에 "서버 상태 로드 전에는 쓰기 금지" 가드 추가. 복구는 설정 → 영상 생성 모드 → 로컬 AI 재선택. tsc + iOS export 통과.
## [2026-07-17] incident+service | mayo 웹 구글 로그인 gsi/transform 멈춤 → 전체 페이지 리디렉션으로 교체 (밤샘 배치 4). GIS 팝업 방식이 모바일 사파리(서드파티 쿠키 차단)에서 gsi/transform에 멈추는 문제(오너 재현) → 웹은 팝업 없이 accounts.google.com/o/oauth2/v2/auth로 전체 페이지 이동(response_type=id_token, redirect_uri=origin, nonce) 후 돌아온 URL 프래그먼트의 id_token을 AuthProvider가 기동 시 감지·로그인·URL 정리. GIS 스크립트/버튼 제거. 전제: 구글 클라이언트의 승인된 리디렉션 URI에 https://www.mayo.im (등록됨). tsc + iOS/web export 통과.
## [2026-07-17] decision | mayo ADR 0013 — SQLite 도입 (밤샘 배치 5). JSON 파일/메모리 영속화를 실제 DB로: app/db.py(media/mayo.db, WAL, docs(kind,id,doc,seq) 문서 테이블, 프로세스 락). auth(유저+세션)·video(보관함)·explore/explore_comment(피드·좋아요·댓글 — 이제 재시작에도 유지)가 기동 시 로드 + 변경 시 write-through. 레거시 JSON은 1회 마이그레이션 후 *.migrated로 개명. 테스트: 문서 왕복/순서, 피드 재시작 생존, 테스트 격리 수정 포함 전체 통과.
## [2026-07-17] incident+service | mayo 네이티브(Expo Go) 구글 로그인 — 서버 경유 플로우로 교체 (밤샘 배치 6). gsi/transform 멈춤이 웹이 아닌 Expo Go에서 발생(오너 정정) — 인앱 OAuth 리디렉션을 구글이 거부하는 Expo Go 한계. 해법: 유튜브 연결과 동일한 서버 경유 방식 — POST /v1/auth/google/start(일회용 loginId+동의 URL) → 사용자가 브라우저에서 승인 → 등록된 콜백(/v1/publish/youtube/callback)이 state 접두사 "login."로 분기해 code 교환·id_token 검증·세션 발급 → 앱이 GET /v1/auth/google/result 폴링(2초, 최대 3분)으로 세션 수령(adoptSession). expo-auth-session 의존 제거. 콘솔 추가 설정 불필요(기존 리디렉션 URI 재사용). 테스트: start/poll/일회성/미설정 400 (pytest 67/67); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 웹 영상 재생 수정 — 미디어 인증 쿼리 토큰 (밤샘 배치 7). 웹 <video>는 인증 헤더를 못 보내서 mayo.im에서 로그인해도 보호된 미디어(/v1/media/*)가 401로 재생 불가였음. 해법: require_api_key가 ?s=<세션토큰> 쿼리 파라미터도 자격증명으로 인정(브라우저 네이티브 로더용), 앱은 중앙 mediaUrl() 헬퍼로 모든 플레이어 URL(보관함 상세·릴스·탐색 미리보기·잡 미리보기·편집기)에 세션을 부착. 테스트: 유효 세션 ?s= 통과/가짜 401 (pytest 68/68); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 실제 썸네일 (밤샘 배치 8). GET /v1/thumb/{key} — 저장된 영상의 포스터 프레임(JPEG, 480w, ffmpeg -ss 0.3)을 첫 요청 시 생성해 storage(thumbs/)에 캐시, Cache-Control 1일. 앱: thumbUrl() 헬퍼(재생경로→썸네일경로, 세션 쿼리 포함) — 보관함 카드와 탐색 카드가 색 박스 대신 실제 첫 프레임을 표시(없으면 기존 accent 폴백). pytest 68/68; tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 탐색 알고리즘 + 편집기 트림 미리보기 (밤샘 배치 9). (1) 탐색 "인기" 정렬이 좋아요 단독이 아닌 참여도+신선도 점수(좋아요×3 + 댓글×2 + 최신성 부스트 최대 +3)로 랭킹 — 초기 인기작이 피드를 영구 점유하지 않음. (2) 편집기 미리보기가 트림 구간을 실제로 반영: 선택 클립의 [시작,끝] 안에서만 반복 재생(250ms 감시) — 보이는 그대로 내보내짐. pytest 68/68; tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 결과 길이 검증·보충 생성 루프 (밤샘 배치 10). 요청 길이는 "예측"이 아니라 "보장"이 되도록: 워커가 스티칭 후 ffprobe로 결과 영상의 실제 길이를 측정하고, 요청보다 짧으면(허용오차 0.25s) 측정된 평균 클립 길이 기준으로 부족분만큼 씬을 추가 생성(감독 씬 프롬프트 순환) → 재스티칭 → 재측정을 반복(최대 5라운드, max_scenes 상한). 진행 중 scenesTotal/scenesDone·씬 미리보기도 계속 갱신되고, 보충 생성 실패 시 잡을 실패시키지 않고 현재 결과 유지. 보관함 길이 라벨도 계산값 대신 실측값 사용(외부 API처럼 클립 길이가 들쭉날쭉해도 정확). 테스트: 보충 계산식 경계/캡, ffprobe 파싱·누락 키(pytest 70/70).
## [2026-07-17] service | mayo 허술함 정리 — 유튜브 상세 입력 + 실명 작성자 (밤샘 배치 11). (1) 유튜브 게시: 태그 입력(쉼표 구분 → snippet.tags, 30개/75자 정제) 추가, selfDeclaredMadeForKids=false 명시(업로드 후 유튜브 스튜디오의 아동용 지정 요구 방지). 제목/설명/공개범위는 기존에도 전송됨 — 태그·아동용 설정으로 상세 입력 보강. (2) 탐색 게시·댓글 작성자가 "@me" 하드코딩이던 것 → 로그인 유저의 실제 이름(@이름)으로 기록(비로그인만 @me 폴백). pytest 70/70; tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 감독 "수정 모드" — 기존 영상을 채팅으로 고치기 (밤샘 배치 12). 오너 의도 반영: 감독은 새 기획뿐 아니라 만들어진 영상의 수정 도구. (1) Video가 생성 레시피(prompt + scenePrompts)를 보관(add_from_job에서 저장, DB 영속). (2) 보관함 상세에 "AI 감독과 수정" 버튼 → /director?videoId=로 진입하면 감독이 기존 씬 구성을 숨김 컨텍스트로 불러온 상태에서 대화 시작("'제목' 영상을 불러왔어요…"). "2번 장면을 밤으로 바꿔줘" 식 지시 → 각본 갱신 → 생성 누르면 수정판이 새 영상으로 렌더(원본 유지). 숨김 컨텍스트는 모델에만 전달되고 화면 대화창엔 안 보임. pytest 70/70; tsc + iOS/web export 통과.
## [2026-07-17] decision | mayo 캐릭터 일관성(프롬프트 앵커링) + 크레딧 과금/비례 환불 (밤샘 배치 13, ADR 0014). 리서치(StoryDiffusion arXiv:2405.01434, ConsiStory, IP-Adapter, CharaConsist arXiv:2507.11533) 결과, 어텐션 공유 계열은 "한 프로세스가 전 프레임을 함께 렌더"할 때만 가능 — mayo는 씬을 독립 렌더(외부 API 포함)하므로 모든 백엔드에서 통하는 채널은 프롬프트뿐. 적용: Screenplay.characters(캐릭터당 시각 묘사 1문장, 감독이 씬 프롬프트에 "VERBATIM 반복"하도록 시스템 프롬프트 지시) + 앱이 style+characters를 stylePrompt로 합쳐 전송 → 워커가 모든 씬(보충 클립 포함) 렌더에 선행 결합. 부수 버그 수정: 각본 style이 렌더러에 전달 안 되던 문제. 크레딧: 가입 시 100 지급, 잡 생성 시 로그인 유저에게 견적가 선차감(잔액 부족 402+한글 사유), 취소 시 round(차감액×미렌더 씬/전체 씬) 환불(6개 중 2개 후 취소 → 4/6 환불) — DELETE가 {refundedCredits, credits} 반환, 앱 토스트로 환불 표시. IP-Adapter(참조 이미지 고정)는 로컬 전용 에스컬레이션으로 문서화. 테스트 tests/test_credits.py 7건 추가.
## [2026-07-17] service | mayo 편집기 실동작 수정 — 실제 길이·라이브 미리보기 (밤샘 배치 14, 오너 스크린샷 제보). 원인: 편집기가 클립 길이를 durationLabel 파싱으로 얻는데 편집/가져온 영상은 라벨이 "—"라 길이 0 → 구간 0:00–0:00, 분할/타임라인 전부 무력화 + 배속/필터가 미리보기에 반영 안 돼 "적용 안 됨"으로 보임. 수정(KineMaster/CapCut 방식): (1) 플레이어 메타데이터 로드 후 실제 길이 채택(라벨 무시), (2) 배속이 미리보기 playbackRate에 즉시 반영, (3) 필터는 blend-mode 오버레이(mono=saturation 회색, warm/cool=soft-light 틴트, vivid=saturation)로 근사 미리보기(내보내기는 기존 ffmpeg 체인 그대로), (4) 자막 미리보기 오버레이(위치 top/center/bottom 반영), (5) 타임라인 클립 폭이 실제 길이에 비례(NLE식), (6) 소스 선택기·타임라인 칩에 실제 썸네일. 서버: add_film이 ffprobe로 실측 길이 라벨, add_from_job이 실제 파일 크기 라벨(“— MB” 제거). 썸네일 401 대비: RN Image에 인증 헤더 동봉(mediaHeaders). pytest 77/77; tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 스토리보드 퍼스트 플로우 (밤샘 배치 15, 오너 요청 "AI가 먼저 스토리보드 보여주고 피드백하고 ok하면 만들어지는식"). 각본이 ready 되면 앱이 자동으로 씬별 저비용 스틸 미리보기를 요청(POST /v1/director/storyboard → 1.5s 폴링) → 감독 카드에 씬 번호 달린 스토리보드 스트립 표시 → 마음에 안 들면 채팅 피드백(각본 수정 시 시그니처 변경 감지로 자동 재렌더) → OK(생성 버튼)일 때만 실제 영상 잡 생성(크레딧 과금도 이때만). 백엔드 렌더: external=Nano Banana 스틸 1장/씬, comfy=8프레임 쇼트 클립(LCM이라 수 초, 포스터 프레임 표시·움직임 미리보기 겸용, MAYO_STORYBOARD_FRAMES), mock=순수 파이썬 1×1 PNG 컬러카드(오프라인 테스트 가능). stylePrompt(일관성 블록)도 스토리보드에 동일 적용. external은 잡과 동일한 프리미엄 게이트 공유(스토리보드 자체는 무과금 설계). 부가: 유튜브 업로드된 영상은 상세 화면 주 버튼이 빨간 "YouTube에서 보기"로 바뀌고 재업로드는 보조 버튼으로; 기존 레코드의 "—"/"— MB" 라벨은 서버 기동 시 ffprobe/파일 크기로 백필. 테스트 3건 추가(pytest 80/80); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo SNS 로그인 확장(GitHub·Apple) + 앱 로고 적용 (밤샘 배치 16). GitHub: 구글 네이티브와 동일한 서버 주도 start/poll 플로우(전 플랫폼 공용) — POST /v1/auth/github/start → 브라우저 동의 → 전용 콜백 /v1/auth/github/callback(1회용 state가 인증) → 코드 교환 후 프로필/이메일(primary+verified) 조회 → 세션 발급, 앱은 2초 폴링으로 수신. 오너 액션: github.com/settings/developers에서 OAuth 앱 등록(콜백 URL 위와 동일) 후 GITHUB_OAUTH_CLIENT_ID/SECRET을 미니 .env에 추가. Apple: expo-apple-authentication(Expo Go iOS 지원)으로 기기에서 identityToken 획득 → POST /v1/auth/apple → 서버가 Apple JWKS로 RS256 서명·aud(host.exp.Exponent, APPLE_OAUTH_AUDIENCES) 검증(PyJWT[crypto], lazy import라 미설치여도 API는 무사) → 세션 발급. iOS에서만 버튼 노출(isAvailableAsync). 로그인 화면에 오너 제공 로고 표시 + icon/splash/favicon/adaptive 아이콘 전부 새 M 로고로 교체(스플래시 배경 #100F14). AuthUser.provider에 github/apple 추가. pytest 83/83; tsc + iOS/web export 통과. 참고: 오너의 Expo 계정 "Third-Party Sign Up" 화면은 이메일이 이미 이메일/비번 계정으로 존재해 SSO 가입이 막힌 것 — expo.dev/forgot-password로 비번 설정 후 npx expo login이 정답.
## [2026-07-17] service | mayo 탐색 탭 = 릴스 피드 (밤샘 배치 17, 오너 스크린샷 요청 "익스플로러는 릴스형태로"). 카드 그리드 제거 — 탐색 탭 자체가 인스타 릴스식 세로 풀스크린 페이저: 영상이 화면을 채우고, 우측 액션 레일(좋아요·댓글 수), 하단 작성자+팔로우+제목+리믹스 버튼, 위로 스와이프해 다음 영상. 상단 플로팅 칩으로 인기/최신 전환, 당겨서 새로고침. 구현: 릴스 피드를 src/explore/reels-feed.tsx 공용 컴포넌트로 추출(탭 안에서는 onLayout으로 실제 뷰포트 측정 — 탭바 높이 대응), 기존 /reels 라우트는 얇은 래퍼로(좋아요 모음·딥링크 용, 닫기 버튼만 추가). 빈 피드 상태 문구 추가. tsc + iOS/web export 통과.
## [2026-07-17] decision | mayo 릴스 랭킹 v2 + 공개 템플릿 (밤샘 배치 18, ADR 0015). 오너 요청 "릴스 알고리즘 논문/공식 검색해서 적용" — 조사: TikTok식 산업 랭킹(Score=Σ P_task×V_task, 시청/깊은 참여 가중 우위), Hacker News gravity((P−1)/(T+2)^1.8), Reddit hot(log 참여+선형 최신성), YouTube 기대 시청시간(Covington 2016). 적용 공식: score = (likes×3 + comments×5 + views×0.3 + 1) / (age_hours+2)^1.5 — 깊은 참여(댓글)>좋아요>노출(조회) 순 가중, HN형 시간 감쇠(소규모 피드라 g=1.5), +1 바닥값으로 신규 아이템 콜드스타트 해결(초기 승자 고착 구조적 제거). ExploreItem에 views/createdAt 추가(레거시 행은 저장 순서 보존 백필), 앱이 릴이 활성화될 때 노출 핑(POST /view). 시청 완료율은 다음 업그레이드로 명시. 공개 템플릿: 게시 시 생성 레시피(scenePrompts+stylePrompt)가 아이템에 복사되고, 릴의 "이 템플릿 활용해보기"가 감독을 템플릿 컨텍스트로 열어 누구나 변형 제작 가능(GET /v1/explore/{id}). 테스트 2건 추가(참여 가중 순서·감쇠·노출 핑·레시피 게시, pytest 85/85); tsc + iOS/web export 통과. 부가: 로고 파일 무결성 확인(채팅 미리보기 깨짐과 무관) 후 원본 전송.
## [2026-07-17] service | mayo 릴 외부 공유 + shares 랭킹 신호 (밤샘 배치 19). 릴 액션 레일에 공유 버튼(종이비행기): 네이티브는 mp4를 캐시로 받아 OS 공유 시트로 전달(카톡/메시지/에어드랍 등 — 받는 사람은 mayo 계정 불필요), 웹은 Web Share API(파일 지원 시) → 미지원 브라우저는 다운로드 폴백. 공유 시트가 완료되면 POST /v1/explore/{id}/share 핑 → ExploreItem.shares 증가, ADR 0015 공식에 shares×8로 반영(공유=앱 밖에서 콘텐츠를 보증하는 최심층 신호, TikTok 순서 shares>comments>likes>views 그대로). 버그 수정: 네이티브 구글 로그인 버튼이 앱측 GOOGLE_CLIENT_ID env에 걸려 사라지던 것 — 서버 주도 방식이라 클라이언트 ID가 필요 없으므로 네이티브에선 항상 노출(웹 리다이렉트 플로우만 client id 게이트 유지). pytest 85/85; tsc + iOS/web export 통과.
## [2026-07-17] incident-fix | mayo 감독 답변에 내부 지시문 유출 (밤샘 배치 20, 오너 스크린샷 제보). 증상: "ㅎㅇ" 인사에 감독이 "…Reply in kind… Keep in Korean.] 안녕하세요!"처럼 영어 메타 노트(무대 지시문)를 답변 앞에 그대로 노출. 원인: 모델이 [ … ] 괄호 메타를 reply 필드에 포함(여는 괄호가 잘린 채로도) — 서버가 무가공 표시. 수정: (1) _clean_reply() 새니타이저 — 완전한 [ … ] 블록 제거 + "한글 없는 앞부분이 이른 ']'로 끝나고 나머지가 한글"인 잘린 메타 프리픽스 제거, Claude/로컬 두 플래너 출구에 공통 적용. (2) 시스템 프롬프트에 "reply는 유저에게 보이는 말 그 자체 — 메타 노트/무대 지시/괄호 텍스트 금지" 명시. 회귀 테스트 4케이스 추가(pytest 86/86).
## [2026-07-17] service | mayo 탐색 샘플 시딩 (밤샘 배치 21, 오너 요청 "더미영상들 넣어줘"). POST /v1/explore/seed — 미니의 ffmpeg로 세로 릴스 규격(576×1024, 4초) 테스트 클립 6개를 실시간 생성해 '@mayo-sample' 계정으로 게시. 제목/프롬프트/색조(hue)/좋아요/조회수/나이(0.5h~48h)를 다양하게 세팅해 ADR 0015 랭킹이 눈에 보이게 함(신선한 저참여 vs 오래된 고참여). scenePrompts+stylePrompt 포함이라 "이 템플릿 활용해보기"도 샘플로 시험 가능. ?clear=true로 샘플만 일괄 제거(재시딩 시 중복 방지). 앱: 피드가 비었을 때 "샘플 영상으로 채우기" 버튼 + 피드에 내용이 있어도 우상단 플라스크 버튼으로 시딩 가능(탐색 탭 한정). ffmpeg 없는 환경은 501 한글 안내. 참고: 네이티브 구글 로그인은 서버 주도라 앱 env(GOOGLE_CLIENT_ID) 불필요 — 배치 19에서 버튼 상시 노출로 이미 해결, 웹(mayo.im)은 Vercel env 사용이라 미니 재시작과 무관. 테스트 1건 추가(pytest 87/87); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 알림 벨을 헤더로 이동 (밤샘 배치 22, 오너 UX 피드백 "알림이 내 계정 안쪽에 있는 게 어색"). 공용 Screen 헤더(만들기·작업·보관함·마이 4개 탭)에 우상단 알림 벨 + 읽지 않음 배지(99+ 캡) 추가 — 어느 탭에서든 한 번에 알림함 진입. 마이 페이지의 알림함 리스트 행은 중복이라 제거(좋아요 모음·내 영상 행은 유지), 마이 탭 아이콘의 배지는 유지. tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 계정 연동 — 한 계정에 여러 SNS 로그인 (밤샘 배치 23, 오너 요청). 유저 레코드에 identities[{provider,email}] 추가. SSO 로그인 매칭 순서: ①연동된 identity(다른 이메일이어도 OK) → ②주 이메일 동일 → ③신규 생성 — 같은 이메일의 구글/깃헙/애플은 자동으로 한 계정에 합쳐지고, 로그인할 때마다 해당 identity가 계정에 기록됨(idempotent). 명시적 연결: 로그인 상태에서 마이 페이지의 새 "로그인 연결" 카드(Google/GitHub/Apple 행, 연결됨/연결하기 표시) → 서버 주도 start(?link=1, 세션 필수 401)/poll에 linkUserId를 실어 완료 시 로그인 대신 identity를 현 계정에 부착(poll이 {linked} 반환), Apple은 POST /v1/auth/apple에 link=true. 충돌 방지: 한 provider+email은 단 한 계정에만 — 이미 남의 계정이면 연결 거부(한글 안내). to_public이 providers[] 노출, 마이 계정 카드가 연결된 방법 전부 표시(예: "이메일 · Google · GitHub"). 테스트 2건 추가(identity 연결/중복/충돌, ?link=1 플로우 e2e — pytest 89/89); tsc + iOS/web export 통과.
## [2026-07-17] setup | Expo 계정/터널 고정 해결 (오너와 실시간 트러블슈팅). 기존 Gmail-SSO Expo 계정은 CLI 로그인이 불가(SSO 가입이 기존 이메일 계정과 충돌하는 "Third-Party Sign Up" 막힘) → 새 이메일+비밀번호 계정 efforthyee 생성으로 우회, 미니 CLI 로그인 완료. 부수 발견: launchd(비-TTY) 로그에는 터널 URL이 안 찍힘("Tunnel ready."만) — URL 복구법(dev 서버에 curl로 hostUri 조회 또는 .expo/settings.json의 urlRandomness 조합)을 runbook에 기록. 웹 터미널(home.efforthye.com)의 한글 붙여넣기 깨짐 재확인 — 오너에게 주는 명령은 영문 전용으로. 폰 접속 정상화 확인됨.
## [2026-07-17] service | mayo 공유 = 홍보 링크 + 공개 릴 페이지 (밤샘 배치 24, 오너 피드백 "모래시계 에바, 영상만 보내지 말고 앱/웹 홍보되게"). 파일 다운로드 공유(느려서 모래시계가 필요했던 원인) 폐기 → 공유 시트가 즉시 열리고 홍보 문구+링크 전송: "mayo로 만든 AI 영상이에요 🎬 보고 나도 만들어보기: https://mayo.im/reel/<id>" (웹은 Web Share, 미지원 시 클립보드 복사+토스트). 받은 사람은 계정/로그인 없이 mayo.im/reel/<id>에서 시청 — 새 공개 페이지: mayo 로고+태그라인, 세로 플레이어, 작성자/좋아요/댓글, 생성 프롬프트 카드, "나도 AI 영상 만들기 — 무료" CTA. 백엔드: 비인증 /v1/public/reels|media|thumb/{id} — 탐색에 게시된 아이템만 서빙(아이템 id가 capability, 임의 스토리지 키 접근 불가; Range 처리 재사용으로 iOS Safari 재생 OK). 모래시계 상태 제거(즉시 공유라 busy 불필요). 테스트 1건 추가(무인증 접근 성공+미게시 404, pytest 90/90); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 유저별 데이터 분리 + 비로그인 탐색 (밤샘 배치 25, 오너 요청). (1) 유저별 분리: Video.ownerId + JobStore 오너 맵 기반 필터 — 보관함/작업 목록이 "내 것 + 소유자 없는 레거시(익명 생성분)"만 노출, 남의 영상/작업은 안 보임. 워커가 잡 오너를 영상에 승계, 편집 내보내기도 세션 오너 기록. 저장공간도 호스트 전체 디렉토리 크기가 아니라 "내 영상 파일 합"으로 계산(스토리지 백엔드에 size() 추가, 로컬은 getsize). (2) 비로그인 탐색: /v1/public/explore(목록·댓글 GET, view/share 핑 POST) 공개 미러 추가 — 게시(publish)/좋아요/댓글 작성 등 신원이 필요한 쓰기는 기존 인증 라우터 유지. 앱은 401 시 공개 미러로 자동 폴백(reqPublic), 릴 재생은 아예 공개 media 엔드포인트로 통일(로그아웃 상태 mayo.im에서도 피드 시청 가능). 테스트 2건 추가(오너 스코핑·익명 미러, pytest 92/92); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 웹 릴스 페이징·탭바 수정 (밤샘 배치 26, 오너 웹 제보). (1) 웹 릴스가 다음 영상으로 안 넘어가던 원인: react-native-web은 FlatList pagingEnabled/snapToInterval을 무시 → CSS scroll-snap(y mandatory 컨테이너 + 페이지별 snapAlign start/stop always)으로 웹 페이징 구현, 활성 인덱스는 viewability 이벤트 대신 스크롤 오프셋에서 계산(웹에서 viewability 불안정). 마우스 사용자를 위해 우측 중앙에 위/아래 화살표 버튼(scrollToIndex) 추가 — 휠·트랙패드·클릭 모두 페이지 단위 이동. (2) 데스크톱 웹에서 하단 탭바가 전체 폭으로 늘어나 버튼이 비정상적으로 넓어지던 것 → 웹에서만 탭바를 콘텐츠 최대폭으로 제한하고 중앙 정렬(margin auto). pytest 92/92; tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 편집기 자막 폰트 — 언어별 무료 폰트 자동 다운로드 (밤샘 배치 27, 오너 요청). app/fonts.py: 자막 텍스트의 문자(한글/가나/한자/라틴)를 감지해 언어에 맞는 Noto Sans(KR/JP/SC/기본)를 Google Fonts 저장소(전부 OFL 오픈라이선스)에서 첫 사용 시 다운로드 → media/fonts/ 캐시 → ffmpeg drawtext fontfile로 결합. 스타일 폰트 2종 추가: 제목체(Black Han Sans)·손글씨(Nanum Pen Script) — 해당 스크립트 미지원 텍스트는 자동으로 언어별 고딕 폴백, 다운로드 실패 시 호스트 폰트(MAYO_EDIT_FONT) → 무필터 재렌더 순서로 절대 렌더가 깨지지 않음. EditClip.font(auto|title|hand) 추가, 편집기 자막 섹션에 폰트 칩(기본/제목체/손글씨) + 미리보기 근사(볼드/이탤릭). 테스트 3건(언어 감지·캐시/폴백·drawtext 결합, pytest 95/95); tsc + iOS/web export 통과.
## [2026-07-17] decision | mayo 관리자 콘솔 (밤샘 배치 28, ADR 0016, 오너 요청 "관리자 페이지 — 통계·유저보드·관리에 필요한 모든 것"). 접근 모델: 별도 관리자 로그인 없이 MAYO_ADMIN_EMAILS(기본: 오너 이메일)에 등재된 계정의 일반 세션이면 통과, 아니면 403 — 앱은 이 403을 프로브로 써서 마이 페이지의 "관리자 콘솔" 진입로 자체를 비관리자에게 숨김. API(/v1/admin/*): 통계(유저·7일 가입·활성 세션·영상·저장소 총량·작업 파이프라인·게시물·참여 합계·유통 크레딧·현재 백엔드), 유저 보드(이메일/연동 SNS/플랜/크레딧/영상 수/BYOK), 크레딧 지급·차감(±10만 상한), 플랜 변경, 유저 삭제(본인 삭제 차단), 게시물 강제 삭제(모더레이션). 앱 /admin 화면: 통계 카드 그리드 + 유저 보드(+100 크레딧·플랜 순환 버튼) + 탐색 게시물 관리 리스트. 부수 수정: 로그인 유저의 저장공간이 "본인 소유 파일만" 계산되도록 조정 — 신규 계정은 0에서 시작(무소유 레거시는 익명/개발 모드에서만 집계), 오너 질문 "유저별 스토리지 초기화 맞아?"에 대한 완결. 테스트 4건(이메일 게이트·통계/보드·크레딧/플랜·모더레이션, pytest 99/99); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 좋아요·저장 분리 + 계정당 좋아요 1회 (밤샘 배치 29, 오너 피드백). 그동안 하트가 "서버 좋아요 카운트 증가"와 "내 기기 저장 목록"을 겸했는데 인스타처럼 분리: (1) 하트 = 순수 좋아요 — 로그인 계정은 서버가 likedBy(아이템별 좋아요한 계정 집합, SQLite kind explore_like로 영속)로 계정당 1회를 강제(중복 누르면 no-op, 취소도 본인 것만), 목록 조회 시 likedByMe로 내 좋아요 상태가 기기 바뀌어도 유지; 비로그인은 기존 카운터+기기 가드 유지. 앱은 옵티미스틱 토글(즉시 하트 색·숫자 반영). (2) 저장 = 새 북마크 버튼(하트 아래) — 서버에 아무 신호도 안 보내는 개인 로컬 컬렉션, 마이 페이지 "저장한 영상"(구 좋아요한 영상, 아이콘도 북마크로)에 모임. 라벨/빈 상태 문구 정리. 테스트 1건 추가(계정당 1회·주석·이중 취소 no-op, pytest 100/100); tsc + iOS/web export 통과.
## [2026-07-17] service | mayo 화면 좌우 여백 절반 축소 (밤샘 배치 30, 오너 요청 "좌우 여백 절반으로 화면 넓게"). Spacing에 screen(12px) 토큰 추가 — 기존 화면 가장자리 패딩(Spacing.four=24px)의 절반. 앱 전 화면(탭 4종·상세·감독·편집기·로그인·설정·플랜·알림·관리자·릴스 하단 정보/댓글 시트·토스트) 15개 파일의 paddingHorizontal을 일괄 교체해 콘텐츠 가용 폭 확대. tsc + iOS/web export 통과.
## [2026-07-18] setup | 관리자 등록 명령 오경로 사건 + 재발 방지. 오너에게 준 .env 수정 명령이 미니 레포 경로를 ~/claude-code-space로 추정해 실패 — 실제 경로는 ~/programs/work/creiip/claude-code-space (위키에 있었는데 확인 안 함). 자동 탐색(find) 버전으로 해결, MAYO_ADMIN_EMAILS 반영 + API 재시작 확인. 재발 방지: mayo-dev-autosync 런북 최상단에 "미니 정식 레포 경로" 박스 추가 — 오너용 명령은 반드시 이 경로를 복사해서 작성할 것. 부수: 플레이스홀더(OTHER@EMAIL.COM)가 목록에 들어갔으나 무해, 정리 명령 전달.
## [2026-07-18] service | mayo 영상 비율 프리셋 (밤샘 배치 31, 오너 요청 "숏츠/1:1/유튜브 등 비율 지정 + 실제 그 크기로"). CreateJobRequest/Job에 aspect(16:9|9:16|1:1|4:5|21:9, 기본 16:9, 스키마 검증) 추가. 실제 렌더 크기 반영: ComfyUI 백엔드에 per-job 크기 오버라이드 — 프리셋별 해상도(유튜브 640×360, 숏츠 360×640, 정방형 512×512, 세로 448×560, 시네마 768×328; 전부 8의 배수·AnimateLCM 최적 512px대) 워크플로 주입, 외부 모드는 Nano Banana 이미지 단계에 aspectRatio 전달. 보관함 해상도 라벨도 실제 크기(예: 360×640) 표시. 앱: 만들기 화면에 "화면 비율" 칩 5종, AI 감독 진입 시에도 선택한 비율이 따라가서 감독 생성 잡에 적용. 테스트 3건(8의 배수 검증·잡 전달/기본값/422·Comfy 워크플로 주입, pytest 103/103); tsc + iOS/web export 통과.
## [2026-07-18] service | mayo UI 이모지 전면 제거 + 디자인 규칙 명문화 (밤샘 배치 32, 오너 지시 "아이콘 이모지 넣지 마, 앞으로도"). 관리자 콘솔 통계 카드/게시물 관리 행, 공개 릴 페이지의 이모지 카운터를 텍스트 라벨(좋아요/댓글/공유/조회, i18n)로 교체, 알림 제목·공유 문구의 장식 이모지도 제거. apps/mayo/AGENTS.md 최상단에 "제품 어디에도 이모지 금지 — 아이콘은 Ionicons, 라벨은 텍스트" 규칙 명문화(향후 세션에도 적용). tsc + iOS/web export 통과.
## [2026-07-18] service | mayo prod-hardening — 가짜 성공 제거·mock 경로 관리자 전용 (밤샘 배치 33, 오너 지시 "mock 하나도 없어야, 전부 prod"). 전수 감사 후 조치: (1) POST /v1/billing/validate — 영수증을 검증 없이 entitled=true로 돌려주던 가짜 검증 → 실제 스토어 검증 전까지 501 거부(플랜은 실경로인 Stripe 결제+서명 검증 웹훅으로만 부여). (2) 유튜브 미연결 상태의 게시 — accepted=true 가짜 성공 → 400 "유튜브 채널 연결이 필요해요". (3) "클립별 다운로드" 죽은 버튼("곧 지원" 토스트) 제거. (4) 설정의 mock("빠른 미리보기") 백엔드 칩과 탐색 샘플 시딩(플라스크·빈피드 버튼) — 관리자 프로브(403) 성공 시에만 노출. (5) 팔로우 버튼 — 서버 미반영(기기 로컬 전용) 가짜 소셜 기능이라 서버 구현 전까지 숨김. 잔여 mock 현황은 브리핑에 정리(mock 백엔드/플래너는 관리자용 개발 도구로 유지, S3 스텁은 미선택 경로, 앱 IAP mock은 사경로). 테스트 2건 갱신(pytest 103/103); tsc + iOS/web export 통과.
## [2026-07-18] service | mayo 유료 게이팅 상시화 + 관리자 미리보기 모드 (밤샘 배치 34, 오너 지시 "클로드는 관리자만, 일반은 결제해야, 무료 기능만 개방 + 관리자용 일반사용자 미리보기"). 서버: premium_gating 기본 ON — Claude 감독·외부 생성은 [유료 플랜 OR 관리자 계정(MAYO_ADMIN_EMAILS) OR 자기 키(BYOK)]만 통과(premium_user_or_none), 무료/익명은 402. 로컬 AI·기본 감독·편집·탐색 등 무료 기능은 전부 개방 유지. 앱: 서버 게이트를 UI에 미러링 — 설정의 외부 API 칩과 감독 선택의 Claude 옵션이 비유료에게 잠금 표시(자물쇠 아이콘·"유료" 태그·탭 시 안내 토스트). 관리자 설정에 "일반 사용자로 보기" 토글(previewAsUser, 로컬 영속) — 켜면 관리자 콘솔 진입로·mock 칩·시딩 버튼이 숨고 유료 잠금이 걸려 무료 유저 화면 그대로 미리보기. 테스트 1건 추가(관리자 통과·무료 402, pytest 104/104); tsc + iOS/web export 통과.

## [2026-07-21] deploy | mayo → password reset + editor keeps original sound (batch 35)
- Auth: `POST /v1/auth/reset/start` emails a 6-digit code (SMTP via `MAYO_SMTP_*`,
  honest 501 when unset, no account enumeration); `/reset/complete` rotates the
  password, revokes old sessions, and signs the user in. Login screen gained a
  full forgot-password flow (email → code + new password).
- Editor: `EditRequest.keepAudio` (default on) keeps each clip's own sound —
  ffprobe audio detection, silent clips get an anullsrc track so concat stays
  uniform, speed changes sync audio via atempo, and a voiceover now MIXES over
  the original sound (amix) instead of replacing it. App: "원본 소리 유지" toggle.
- Verified: pytest 109 passed, tsc clean, iOS + web exports OK.

## [2026-07-21] deploy | mayo → share-link OG thumbnails (batch 36)
- `GET /v1/public/reel-og/{id}` serves a crawler-facing HTML page: og:title/
  description/image (public thumb)/video (public media) + instant redirect to
  mayo.im/reel/<id> for humans. mayo.im's vercel.json rewrites /reel/:id to it
  ONLY for crawler user-agents (Kakao, iMessage/Facebook, X, Slack, Discord,
  Telegram, WhatsApp, search bots) — share links now unfurl with the reel's
  poster frame. New env names: MAYO_PUBLIC_API_BASE / MAYO_PUBLIC_WEB_BASE.
- Verified: pytest 109 passed (OG page assertions added to the public-reels test).

## [2026-07-21] decision | ADR 0017 — pricing: hybrid credits + subscriptions (Free/Pro/Studio + packs)

## [2026-07-21] deploy | mayo → my-posts management + endless reels loop (batch 37)
- Explore: `ExploreItem.ownerId`/`hidden`; `GET /v1/explore/mine` (hidden incl.),
  owner-only `POST hide|unhide` (pulls the post from the public feed AND the
  public share routes, reversible) and owner `DELETE` (permanent, takes comments
  and likes with it). Publish now records the publishing account.
- App: 마이 → "내 게시물" screen — thumbnail rows with like/comment/view stats,
  eye toggle for hide/unhide, two-tap trash confirm for permanent delete.
- Reels feed never dead-ends: the pager renders two copies of the feed and
  silently snaps back a copy when the viewer crosses the seam — infinite loop
  on both native paging and web scroll-snap (web down-arrow never disables).
- Verified: pytest 110 passed, tsc clean, iOS + web exports OK.

## [2026-07-21] deploy | mayo → director chat persists + watch-completion signal (batch 38)
- Director: plain opens now save/restore the whole conversation, screenplay,
  and rendered storyboard (AsyncStorage; the restored storyboard's signature is
  kept so it is NOT re-rendered/re-billed). New-chat reset button in the top
  bar. Revision/template opens keep their dedicated context.
- Ranking: `ExploreItem.watches` — completed plays via `POST /{id}/watch`
  (+ public mirror); app pings once per activation on the player's playToEnd;
  weight 1.5 in the score (ADR 0015 updated).
- Verified: pytest 111 passed, tsc clean, iOS + web exports OK.

## [2026-07-21] deploy | mayo → admin audit log + daily metric time series (batch 39)
- Every mutating admin action (credit grant, plan change, user delete, explore
  takedown) now writes an audit record (SQLite kind `audit`; new `db.append`
  upsert helper). `GET /v1/admin/audit` serves them newest-first.
- Daily time series with zero schedulers: each `/v1/admin/stats` read upserts
  TODAY's snapshot (kind `metric_snap`, id=date) — users/videos/posts/likes/
  views/shares/watches/credits/storage. `GET /v1/admin/timeseries` serves the
  history; the console shows the last 14 days + the audit log.
- Verified: pytest 112 passed, tsc clean, iOS + web exports OK.

## [2026-07-21] deploy | mayo → pricing v2: raised plans + standalone credit packs (batch 40)
- Owner: v1 was too cheap, and credits must be buyable WITHOUT a subscription.
  Plans now Pro $24/월 + 700크레딧, Studio $59/월 + 2,500크레딧 (first month's
  credits granted at the checkout webhook). New credit packs pack100 $12 /
  pack300 $30 / pack1000 $85 — one-time Stripe `mode=payment` checkout, webhook
  grants credits + lifetime `purchasedCredits` marker.
- Premium gate now passes paid plan OR purchased pack OR admin (server AND app
  UI — AuthUser.premium). Plan screen gained a "크레딧 팩" section; plan cards
  show monthly credit grants. Env names: STRIPE_PRICE_PACK_100/300/1000.
- ADR 0017 v2 + index updated. Verified: pytest 113 passed, tsc clean, both
  exports OK.

## [2026-07-21] deploy | mayo → real App Store receipt validation + EAS config (batch 41)
- Stripe cannot onboard Korean merchants — owner pivoted to iOS IAP (deploying
  today). `/v1/billing/validate` is now REAL: Apple verifyReceipt with
  MAYO_APPLE_SHARED_SECRET (prod -> 21007 sandbox fallback), receipt must
  contain the claimed product, grants land on the session account —
  subscriptions im.mayo.{pro,studio}.monthly set the plan + first-month
  credits, consumables im.mayo.pack{100,300,1000} add purchased credits
  (premium marker). Unconfigured -> honest 501; Apple-rejected -> 400.
- App: eas.json (development/preview/production profiles), ios
  bundleIdentifier + android package `im.mayo.app`.
- Verified: pytest 114 passed, tsc clean, both exports OK.

## [2026-07-21] deploy | mayo → MAYO_FREE_TEAM switch for free-Apple-ID local builds
- `app.config.js`: MAYO_FREE_TEAM=1 strips the Sign-in-with-Apple capability so
  `npx expo run:ios --device` can be signed with a FREE Apple ID (personal
  team) — that entitlement is paid-team-only and otherwise fails the build.
  Unset -> app.json passes through untouched (EAS/paid builds unaffected).

## [2026-07-22] decision | payments postponed — Higgsfield first, then margin analysis (ADR 0017 note)

## [2026-07-22] ingest | Higgsfield video-making guides -> wiki/concepts/ai-video-prompting.md

## [2026-07-22] deploy | mayo → director actually works by default + MCSLA prompts (batch 42)
- Owner: "AI 감독이 따로 놀고 제대로 작동 안 함." Root cause: planner default was
  the mock stub unless someone flipped the runtime switch. Now, when the host
  has ANTHROPIC_API_KEY (+ anthropic pkg), the REAL Claude director is used even
  with no runtime selection — mock only remains for hosts with no credential.
- Both director system prompts upgraded with the distilled Higgsfield guidance
  ([[ai-video-prompting]]): MCSLA scene-prompt ordering (Camera -> Subject ->
  Look -> Action), fixed identity / varying motion, escalation arc.
- Verified: pytest 114 passed.

## [2026-07-22] setup | Jira work tracking live — efforthye.atlassian.net / SCRUM (rule in CLAUDE.md)
- Backlog registered: SCRUM-5 힉스필드 실생성 검증, SCRUM-6 BYOK 점검, SCRUM-7
  수익률 분석, SCRUM-9 웹 UI 재구성, SCRUM-10 사용량 로그, SCRUM-11 IAP
  클라이언트, SCRUM-12 웹 결제 PG, SCRUM-13 앱스토어 등록.

## [2026-07-31] setup | 인프라 코드화 착수 + ELK 로그 수집 + 텔레그램 워치독
- **Terraform (ADR 0018, [[terraform-onprem]])** — `infra/terraform/onprem/`에 미니의
  Docker 컨테이너 3종 + Cloudflare DNS 3건을 HCL로 기술. HashiCorp Terraform 1.15.8,
  kreuzwerker/docker 3.9.0 + cloudflare/cloudflare 5.22.0 실제 스키마 기준으로
  `validate`/`fmt` 통과. **아직 import/apply 전** — `docker.tf`의 볼륨·재시작 정책은
  위키 스냅샷에서 추정한 값이라 `scripts/tf-discover.sh`(env는 키 이름만 덤프해 시크릿
  유출 방지)로 실측 후 교정해야 함. 완료 기준은 "plan에 create/replace/destroy 0건".
  범위는 오너 지시대로 **미니 전용**(AWS 확장은 무시). 경계 규칙 명문화: 한 컨테이너는
  한 도구만 — launchd·cloudflared 터널·ELK 스택은 Terraform 밖.
- **ELK (ADR 0019, [[elk]])** — Elastic 9.4.4 (arm64 매니페스트 확인) Elasticsearch +
  Kibana + Filebeat를 미니에 Compose로 기동. **Logstash 제외** (1GB JVM이 하는 일을
  Filebeat가 50MB로 처리). launchd 로그 5종(mayo-api/expo/autopull/comfy/tunnel) 수집 중 —
  실측 **11,693건 색인 확인**. 전 포트 127.0.0.1 바인딩, 외부 노출 0.
  - 맥북에서 리허설로 먼저 띄워 **버그 2건을 미니 배포 전에 발견·수정**:
    (1) filestream이 지문 방식이라 **1KB 미만 파일을 아예 안 읽음** → 작은 로그·갓
    로테이션된 파일 무음 유실. `fingerprint.enabled: false` + `file_identity.native`로 해결.
    (2) 커스텀 필드 `service`(문자열)가 ECS `service` **객체** 매핑과 충돌해 색인 단계에서
    이벤트 드롭 → `service.name`으로 수정.
  - 메모리: 미니는 **ComfyUI가 Docker 밖에서 도는 16GB 호스트**라 Docker VM(5.77GiB)을
    늘리면 생성 엔진이 굶음. VM을 키우는 대신 스택을 VM에 맞춤. 최초 설정(ES 1g/Kibana
    800m)에서 둘 다 **한계의 98%**에 붙어 OOM 직전인 것을 관측 → ES 1.5g,
    Kibana 1g + Node 힙 700m 상한으로 조정, 현재 ES 70.8% / Kibana 78.2%.
  - Kibana 접근은 공개 대신 **launchd 감시 SSH 터널**(`scripts/kibana-tunnel-install.sh`) —
    맥북 `localhost:5601`, KeepAlive로 절전·네트워크 변경·미니 재부팅 후 자동 재연결.
    AWS SSM 포트포워딩과 같은 구조. 검증: Kibana 200 / ES 401(인증 필요=도달).
- **텔레그램 워치독** — `scripts/watchdog-telegram.sh` + `watchdog-install.sh`.
  디스크·시스템 여유 메모리·launchd 에이전트 5종·컨테이너 상태/헬스·컨테이너별 메모리
  (자기 한도 대비)·mayo-api `/health`·ES 클러스터 상태를 5분마다 점검. 미니에서 **21개
  검사 전부 통과** 확인, 임계치를 강제로 낮춰 **실패 감지 7건 + 2회차 중복 억제**까지 검증.
  알림 규율: 실패 전이 시 1회 → 지속 시 6시간 간격 → 복구 시 1회. 토큰은
  `~/.mayo-watchdog.env`(chmod 600, 레포 밖). **가동 완료** — 봇 `@mayo_server_bot` 생성 후
  설치, 실제 토큰으로 🔴 경고 발송·중복 억제·🟢 복구 메시지까지 종단 검증. 5분 간격
  `com.efforthye.watchdog` 에이전트 실행 중. (설치용 임시 스크립트는 토큰이 박혀 있어 삭제함.)
- **미니 SSH 키 인증** — 맥북에 ed25519 키 생성 후 미니에 등록, `~/.ssh/config`에
  `Host efforthye m1mini` 별칭. 비밀번호는 레포·tfvars 어디에도 저장하지 않음(오너가
  채팅에 붙여넣은 값은 **로테이션 권장**).
- **Jira** — 프로젝트 키 `SCRUM` → `MAYO` 변경 반영(CLAUDE.md). 과거 로그의 `SCRUM-N`은
  append-only 원칙상 보존(Jira가 옛 키를 리다이렉트). 이 세션엔 Atlassian 커넥터가 없어
  이슈 생성은 오너 측에서 진행 — 커밋의 `Refs:` 대기 중.
- 잔여: ELK가 `~/elk-stage/`에서 실행 중(레포 체크아웃에 untracked 파일을 넣으면
  autopull의 `git pull`이 깨져서). 커밋 후 레포 경로로 이전 필요. ILM 보존기간 미설정.
  컨테이너 stdout 수집은 Phase B(Docker Desktop for Mac의 VM 경로 제약).

## [2026-07-22] deploy | mayo → staged review screen: blank stills + stuck 0/N approvals fixed (batch 43)
- Blank images: review.tsx built the still URL from the bare storage key
  (mediaUrl(imageKey)) — missing the /v1/media prefix made a broken host and
  every still rendered blank. Now mediaUrl(`/v1/media/${key}`).
- Stuck approvals at the clips stage: nothing ever STARTED clip rendering (the
  server's POST /{job}/clips had no caller in the app), so segments sat at
  'imageApproved' where approve is unmappable — and the server silently
  no-oped, leaving 0/N with no feedback. Fixes: client startClips() + a
  "영상 렌더 시작" footer action on the clips stage, and approve now answers
  409 with the reason instead of no-oping.
- Also: installed expo-haptics (new dep from the parallel session) so exports
  build. Verified: pytest 182 passed, tsc clean, iOS + web exports OK.

## [2026-07-22] incident | deploy restart erased an active render → jobs now persist + resume (batch 44)
- See wiki/incidents/2026-07-22-restart-erased-active-render.md. pytest 183,
  tsc clean, both exports OK.

## [2026-08-01] deploy | mayo → fast path scene continuity: clip N+1 starts on clip N's last frame (batch 45)
- Owner: "두 영상이 이어져야지 — 1의 뒷부분 == 2의 앞부분." The quick create
  path rendered every scene independently (fresh Nano Banana still each time),
  so cuts jumped. generate_scene() now takes init_image; the worker feeds each
  scene the LAST FRAME of the previous clip (segments.last_frame_of), and the
  external backend animates FROM it instead of generating a new still — same
  continuity the staged flow already had. First scene unchanged; mock/comfy
  ignore the param. Verified: pytest 183 passed.

## [2026-08-01] deploy | mayo → progress screen shows per-scene prompts + states (batch 46)
- The job progress screen's bare dots became a scene list: each row shows the
  scene's prompt text and its state (완료 / 렌더 중 / 대기) — you can now see
  WHAT is being made, not just how many. Job.scenePrompts added to the app
  wire type (server already sent it). i18n ko/en/ja.
- Verified: pytest 183 passed, tsc clean, iOS + web exports OK.

## [2026-08-01] deploy | mayo → per-scene prompts must be DETAILED, ending on the final frame (batch 47)
- Owner: "초별 프롬프트 더 상세해야 할 듯." The chat director was explicitly
  told "one sentence per scene" — replaced across all three director prompts:
  every scene prompt is now 3-5 sentences walking the shot second by second
  (camera path, micro-actions in order, environment dynamics, palette) and must
  END by describing the FINAL frame — which is exactly the frame the next clip
  is generated from (batch 45 chaining), so written endings become real
  transitions. Verified: pytest 183 passed (server-only change).

## [2026-08-01] deploy | mayo → cross-dissolve scene transitions in the stitch (batch 48)
- New MAYO_STITCH_DISSOLVE (default 0.3s, 0 = hard cuts): stitching now runs an
  ffmpeg xfade chain between scenes. Combined with frame chaining (batch 45)
  the overlap blends two nearly-identical frames, so cuts read as one
  continuous move. Applies only when every clip is silent and long enough;
  otherwise the plain concat path runs untouched (audio is never dropped for
  a transition). Verified: pytest 184 passed (offset-chain unit test added).

## [2026-08-01] deploy | mayo → review UX: approve auto-advances; transient errors keep the sheet (batch 49)
- Approving a segment now jumps selection to the next unapproved one — N
  approvals are N taps (owner: "매번 클릭해야 해서 귀찮").
- A transient fetch failure (app resumed from background, tunnel blip) used to
  replace the whole review screen with an error page ("서버 연결 안 된대").
  The error page now shows only when there is no data at all (with a retry
  link); with data on screen the 5s poll heals the connection silently. The
  beat sheet itself was never at risk — it is server-persisted per job.
- Verified: tsc clean, iOS + web exports OK (app-only change).

## [2026-08-01] deploy | mayo → staged jobs no longer render behind the review + busy overlay UX (batch 50)
- BUG (double-billing risk): creating a STAGED job also kicked the legacy
  worker — it rendered and billed scenes behind the review screen while the
  user was still approving beats, and its 'generating' status hid the clips-
  stage start button. Staged jobs now render nothing until the clips gate.
- Review UX (owner): approve/redo buttons hidden until the image/clip actually
  exists (a hint says where to start instead of a button that 409s); busy state
  is a CENTERED overlay with rotating tips + "나가도 계속 진행, 끝나면 알림"
  note, replacing the beside-the-button spinner.
- Verified: pytest 184, tsc clean, iOS + web exports OK.

## [2026-08-01] deploy | mayo → failed films salvage their scenes; quotes on the pay button (batch 51)
- Owner: two films died at scene 2/2 and the PAID scene 1 vanished with them.
  (1) A scene that fails WITH the continuity frame retries once without it —
  the chaining input was the prime suspect for the scene-2 deaths, and it is a
  quality bonus, not a requirement. (2) On a definitive scene failure the
  worker now stitches every rendered clip and files "<title> (부분 N/M)" into
  the library BEFORE marking the job failed — paid material is never discarded
  again; failureReason says which scene died and what was saved.
- The clips-stage start button now carries the cost: "영상 렌더 시작 · N크레딧
  사용" (live /clip-quote). Money is announced before it is spent.
- Verified: pytest 184, tsc clean, iOS + web exports OK.

## [2026-08-01] deploy | mayo → clip files are unique per render — jobs stop overwriting each other (batch 52)
- Scene clips were stored as clips/0000-external.mp4 etc — index-only keys, so
  EVERY job overwrote the previous job's scene files. That is why the failed
  films' paid scene-1 clips cannot be salvaged retroactively: the completed
  film's render overwrote them. Keys now carry a random token per render
  (external + comfy). Found while answering "are my lost scenes back?" —
  honestly: no, and this is the reason they are unrecoverable.
- Verified: pytest 184 passed.

## [2026-08-01] deploy | mayo → business ledger + Telegram owner alerts (batch 53a)
- New app/ledger.py: every signup, payment (Stripe webhook + App Store
  validate), and generation start/done/failed is appended to SQLite kind
  `ledger` (who, when, email, credits, prompt, product, outcome) and mirrored
  to the owner's Telegram when MAYO_TELEGRAM_BOT_TOKEN/CHAT_ID are set
  (silent no-op otherwise; the ledger always records).
- GET /v1/admin/ledger (admin-gated) + "이용 원장" section in the admin console.
- Verified: pytest 185, tsc clean, both exports OK.

## [2026-08-01] deploy | mayo → ledger alerts reuse the existing watchdog Telegram bot (batch 53b)
- Owner: a Telegram alert system already exists (@mayo_server_bot, the infra
  watchdog from 2026-07-31). The business-ledger alerts now read the bot token
  and chat id from the watchdog's ~/.mayo-watchdog.env when MAYO_TELEGRAM_*
  are unset — one bot, one channel, zero additional setup. Verified: pytest 185.

## [2026-08-01] deploy | mayo → tap a scene preview to watch it fullscreen (batch 54)
- Job-detail scene previews are now tappable: fullscreen modal player with
  native controls (sound on, loop), close button top-right. Verified: tsc
  clean, iOS + web exports OK.

## [2026-08-01] deploy | mayo → reliability audit fixes: ownership, paywall, payment idempotency (batch 55)
- Audit fixes, in order of blast radius:
  - IDOR: every job mutator (retry/delete/beats/rewrite/approve/stills/
    reimage/advance/clips/stop/reclip) and the prompt-carrying reads now
    refuse a session that is not the job's owner (admin passes; ownerless
    legacy jobs stay open). Same guard on library get/delete/extend/publish.
  - PUT /v1/settings is admin-only — it flips GLOBAL server backends.
  - Premium-gate bypass closed: stills/reimage/reclip enforce the same
    external-backend gate as the clips stage, and reclip requires a signed-in
    caller to bill (was rendering free without a session).
  - Payment idempotency: Stripe webhook dedupes by event id (SQLite kind
    stripe_evt), App Store validate dedupes by transaction id (kind iap_txn)
    — replays ack/answer without granting again; consumable packs can no
    longer double-grant.
  - Refund on failed render: the per-clip charge in render_clips (and reclip)
    is returned when the render throws; failureReason lands on the job.
  - retry answers 409 while a job is generating (double _run = double bill);
    delete refunds only a removal that actually happened.
  - Orphaned-film NameError: add_from_job passed an undefined prompt_public —
    every completed film was silently dropped from the library. Fixed + test.
  - Film keys unique per stitch (films/{job}-{token}.mp4, edits too) so
    salvage and retry stop overwriting each other; staged clip render tasks
    are strongly referenced (worker.register_task) so GC can't kill them.
  - App: a network failure during session restore no longer deletes the
    stored token — only a real 401/403 signs the user out.
- Tests: 185 → 197 (ownership 403s, gate 401/402, webhook + IAP replay,
  retry 409, refund-on-failure, add_from_job). tsc clean, iOS + web exports OK.

## [2026-08-01] query | competitive landscape research -> wiki/concepts/ai-video-market-2026.md

## [2026-08-01] query | Seedance 2.5 verified (native 30s clips, 50 refs, region edit) -> market page updated
## [2026-08-19] query | 앱스토어 유료 1위 시장조사 → wiki/concepts/paid-appstore-number-one-2026.md (차트 구조·1위 임계치 ≈5,000장/일·승자 6케이스)
## [2026-08-19] service | WHALE FARM — created (프리미엄 경제 로그라이트, 유료 차트 1위 목표, mayo와 무관)
## [2026-08-19] decision | 0021 WHALE FARM $4.99 선불·IAP 없음 / 0022 TS 코어+웹 리그+Godot 4·Steam 선행 / 0023 외부 에셋 0 아트 파이프라인
## [2026-08-19] service | WHALE FARM → M1 경제 코어 + 몬테카를로 하네스(설계 명제 5/5 통과) + M2 플레이어블 웹 프로토타입; status building
## [2026-08-19] setup | Jira 갭: Atlassian 커넥터 미인증 세션 → WHALE FARM 이슈 미생성. 커넥터 복구 시 위 4개 항목을 티켓으로 소급 등록 필요
## [2026-08-19] decision | 0024 선불+콘텐츠 IAP 하이브리드 (오독 정정) / 0025 1차 시장 한국·Steam 선택화 (한국 유료 1위 = Paladog, 동일장르 10위)
## [2026-08-19] service | WHALE FARM → v0.2 조합·press-your-luck·이름 있는 고래 7명 추가, 설계 명제 6/6 통과
## [2026-08-19] decision | 0026 WHALE FARM 폐기 → 팔자(EIGHT PILLARS) 전환. 후킹이 이미지가 아니라 아이디어였던 것이 구조적 결함
## [2026-08-22] service | 팔자 EIGHT PILLARS — created + M1 완료: 오행 채점 엔진, 십신 유물 10종, 완전탐색 최적 배치, 설계 명제 6/6 통과 (배치 ×31.2, 승률 40.5%)
## [2026-08-22] service | 달항아리(moonjar) — 규칙 하나짜리 머지 게임 프로토타입. 어린이·노인도 즉시 이해하는 방향으로 재조정(한국 유료차트 근거: Paladog 1위·Pou 4위·스이카게임 17위). 기획서는 오너 플레이 판정 후 작성
## [2026-08-28] service | 게임 프로젝트 전부 리셋 — whale-farm · eight-pillars · moonjar 코드/기획서/ADR 0021~0026 삭제. Flutter + Flame으로 재출발. 시장조사(paid-appstore-number-one-2026)는 엔진 무관이라 보존
