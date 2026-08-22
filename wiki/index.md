---
title: Index
type: index
tags: [meta]
created: 2026-07-15
updated: 2026-08-19
---

# Index — Service Registry & Catalog

The map of the whole wiki. Read this first on any query, then drill into the relevant pages.
Updated whenever pages are added/renamed or a service's status changes.

## Service registry

| Service | Status | URL / Host | Page |
|---------|--------|-----------|------|
| RichClub (api + front) | live | `home.efforthye.com:8000` (api) / `:3000` (front) | [[richclub]] |
| Jenkins (CI) | live | `home.efforthye.com:9090` | [[jenkins]] |
| Mayo (AI video platform) | live | Expo Go 앱 + **mayo.im** (Vercel) | [[mayo]] |
| mayo-api (orchestration API) | live | mini `:8001` → `mayo-api.efforthye.dev` (tunnel) | [[mayo]] |
| 팔자 EIGHT PILLARS (premium game) | building | 클라이언트 온리 (한국 App Store 유료 1위 목표) | [[eight-pillars]] |
| ~~WHALE FARM~~ | deprecated | 폐기 — [[0026-pivot-whale-farm-to-eight-pillars]] | [[whale-farm]] |

## Infra
- [[home-server]] — Apple M1 Mac mini (8-core, 16 GB, 1 TB, macOS 15.4.1, `arm64`; `m1mini` /
  `home.efforthye.com`) running Docker; CI/CD via [[jenkins]] webhooks. _(status: live)_
- [[elk]] — Centralised logging: Elasticsearch + Kibana + Filebeat on the mini, loopback-only,
  reached from the laptop over a launchd-supervised SSH tunnel. _(status: building)_
- [[terraform-onprem]] — Infrastructure as code for the mini: Docker containers + Cloudflare DNS,
  import-first. _(status: building)_

## Runbooks
- [[deploy-home-server]] — Deploy a service to the home server (current path: Jenkins webhook).
- [[expo-dev-loop]] — Live-preview mobile dev loop: Expo dev server on the mini + Expo Go on phone.
- [[mayo-dev-autosync]] — push → mini auto-pulls → phone Fast-Refreshes (polling script + webhook option).
- [[claude-remote-control]] — Operate the home server from your phone (Claude Remote Control / SSH).
- [[deploy-mayo-api]] — Build & run the mayo-api FastAPI container on the home server _(draft)_.

## Decisions (ADRs)
- [[0002-cicd-via-jenkins-webhook]] — **Current** CI/CD: Jenkins builds & deploys, triggered by
  GitHub webhooks.
- [[0001-github-actions-home-server-deploy]] — _(superseded by 0002)_ Deploy via GitHub Actions +
  `HOME_SERVER` environment.
- [[0003-expo-react-native-for-mobile-app]] — Use Expo/React Native for the mobile app; dev loop
  on the M1 mini with Expo Go.
- [[0004-mayo-storage-local-then-s3]] — Mayo video storage: local filesystem first, migrate to
  S3-compatible object storage past ~half the host disk; abstract storage from day one.
- [[0005-mayo-backend-fastapi]] — Mayo backend is a FastAPI orchestration API (`apps/mayo-api/`),
  stack-consistent with [[richclub]]; schemas mirror the app mocks.
- [[0006-mayo-job-queue-inprocess-then-redis]] — Job queue: in-process asyncio worker first,
  Redis-backed workers + a DB when generation becomes real / needs durability.
- [[0007-mayo-model-provider-abstraction]] — Model calls behind a `ModelBackend` seam (mock now,
  external providers later); swapping in real image/video models is a backend change, not a rewrite.
- [[0008-mayo-ai-director-scenario-planner]] — A Claude **scenario planner** in front of generation
  (prompt+length → typed `Screenplay`); selectable director model (Opus 4.8/Sonnet 5/Haiku 4.5);
  mock (default) vs claude backend. Also records the API-authentication (bearer-key) hardening.
- [[0009-mayo-local-video-generation-comfyui]] — Real **local video generation** on the mini via
  **ComfyUI + AnimateLCM** behind the `ModelBackend` seam; per-scene clips stitched with ffmpeg,
  served + played in-app; mock⇄local is an in-app toggle.
- [[0010-mayo-external-generation-providers]] — Real **paid cloud generation** — Nano Banana (Gemini
  2.5 Flash Image) stills + Higgsfield video — behind the same seam; config-driven ("low-code")
  provider schema; keys from host env; app-selectable (Account → 외부 API).
- [[0011-mayo-accounts-sns-login]] — **Accounts + SNS login**: email/password (scrypt) and Google
  (id_token verified server-side); opaque sessions via `X-Mayo-Session`; login modal + Account
  profile card. Prerequisite for a public mayo.im and per-user BYOK.
- [[0012-mayo-stripe-card-payments]] — **Real payments**: Stripe Checkout on the web (plain REST +
  manual webhook signature verification; plan granted to the signed-in account), mobile IAP deferred
  to a dev build.

- [[0013-mayo-sqlite-database]] — SQLite doc-store (`app/db.py`) replaces JSON files; kinds:
  auth/video/explore/…; legacy JSON auto-migrated.
- [[0014-character-consistency-and-credits]] — Character/style consistency anchoring across scenes
  + credit charging with pro-rata refunds on cancel.
- [[0015-reels-ranking-and-templates]] — Research-grounded reels ranking (likes/comments/shares/
  views with time decay) + template remix from published recipes.
- [[0016-admin-console]] — Admin console (`/v1/admin`, MAYO_ADMIN_EMAILS): stats, user board,
  credit/plan controls, moderation; app `/admin` screen; premium gate bypass for admins.
- [[0017-pricing-credits-subscriptions]] — **Pricing v2**: Pro $24/700cr, Studio $59/2,500cr
  monthly + standalone credit packs ($12/100 · $30/300 · $85/1,000, no subscription needed —
  packs unlock premium); BYOK free-of-credits.
- [[0018-terraform-for-onprem-infra]] — Terraform for the mini only (Docker containers +
  Cloudflare DNS), import-first; launchd, tunnels and the ELK stack deliberately excluded.
  One container, one tool.
- [[0019-centralised-logging-elk]] — Elasticsearch + Kibana + Filebeat (no Logstash), sized to
  fit the mini's Docker VM because ComfyUI needs the host RAM; loopback-only + SSH tunnel.
- [[0021-whale-farm-premium-no-iap]] — WHALE FARM은 **$4.99 선불 유료, IAP·광고 없음**. 유료 차트는
  선불 앱만 집계하므로 가격은 전제조건; "IAP를 소재로 한 게임에 IAP가 없다"가 마케팅 자산.
- [[0022-whale-farm-godot-steam-first]] — 경제 코어(TS) → 웹 설계 리그 → **Godot 4** 출시 빌드,
  **Steam 데모 선행**으로 발매일 수요(위시리스트 10만)를 저장.
- [[0023-whale-farm-zero-asset-art-pipeline]] — 아트 파이프라인과 **라이선스 위생**(에셋 매니페스트
  강제, OFL 폰트·CC0 사운드, 실존 브랜드 금지). _"에셋 0" 전제는 2026-08-19 정정됨._
- [[0024-whale-farm-iap-payment-system]] — **선불 $4.99 + 비소모성 콘텐츠 IAP.** 유료 차트 1·2·4위가
  모두 하이브리드이므로 1위 목표와 양립. 소모성·랜덤·구독은 팔지 않음.
- [[0025-whale-farm-korea-first]] — **1차 시장은 한국.** 한국 유료 1위는 2011년 한국 인디(`Paladog`),
  동일 장르가 10위. 미국은 스트레치 골로, Steam은 선택 사항으로 강등.
- [[0026-pivot-whale-farm-to-eight-pillars]] — WHALE FARM 폐기, **팔자**로 전환. 후킹이 이미지가
  아니라 아이디어였던 것이 구조적 결함. 앞으로 게임 기획은 "6초 영상의 한 장면"에서 역산한다.

## Incidents
- [[2026-07-22-restart-erased-active-render]] — deploy restart wiped an actively rendering job; jobs now persist + resume.

## Concepts
- [[ai-video-market-2026]] — 2026 경쟁 지형(Seedance/Kling/Veo/Higgsfield)·트렌드·mayo 강화 우선순위.
- [[ai-video-prompting]] — Higgsfield/Seedance/Kling 실전 프롬프트 규칙 (MCSLA, 샷 구조,
  캐릭터 일관성) — mayo 감독 프롬프트에 반영할 기준.
- [[expo-go-vs-dev-build]] — Expo Go (generic container, SDK-locked) vs a development build
  (your own compiled app); why mayo will need a dev build.
- [[mayo-web-target]] — running the same Expo app on the **web** (react-native-web, `web.output:
  single`, Vercel) for mayo.im; native-module web guards + the shared-key leak caveat.
- [[paid-appstore-number-one-2026]] — 앱스토어 **유료 1위** 시장 분석(2026-08): 차트 구조, 미국
  유료 게임 1위 임계치(≈5,000장/일 `[추정]`), 승자 6개 케이스, 1위를 만드는 조건 공식화.
