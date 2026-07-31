---
title: Staged, review-gated production flow
type: decision
status: accepted
tags: [decision, mayo, pipeline, ux, generation, director]
created: 2026-08-01
updated: 2026-08-01
---

# 0020 — Staged, review-gated production flow

## Context

Today a film is one shot in the dark: describe it, pay, wait, and find out at
the end whether it is any good. At the measured cost of **$0.384 per 10-second
scene** ([[0017-pricing-credits-subscriptions]] v3) a bad ten-minute render
throws away $23 and 43 minutes. The longer the film, the worse the bet — which
is a problem, because long films are the product.

The owner's design (2026-08-01) fixes this by putting a **review gate between
every expensive step**, and making every unit individually re-runnable.

## Decision

Production runs as four reviewed stages, then edit, then publish. Nothing
expensive happens until the cheap thing before it has been approved.

```
length + idea
   │
   ├─ 1. BEAT SHEET   text per time segment — what happens at 0-10s, 10-20s…
   │      review · revise any segment · approve            (cheap: LLM only)
   │
   ├─ 2. STILLS       one image per segment
   │      review · regenerate ONLY the ones you dislike     (cheap: image model)
   │
   ├─ 3. CLIPS        animate each approved still
   │      per-clip review · continuity carried forward      (EXPENSIVE: video)
   │      mode A "stop on reject" — halt and fix before continuing
   │      mode B "render all"     — finish, then re-render individual clips
   │
   ├─ 4. STITCH       approved clips into one film
   │
   ├─ 5. EDIT         captions, voiceover, music, trims
   │
   └─ 6. PUBLISH      straight to YouTube
```

### Why gates, and why in that order

Each stage costs roughly an order of magnitude more than the one before it.
Reviewing text costs nothing and can save a $23 render. Reviewing stills costs
cents and catches the wrong look before it is animated 60 times. By the time
money is being spent on video, the composition has already been approved.

### Continuity is a stage-3 requirement, not a nicety

Clips are generated independently, so consecutive ones do not match unless
something makes them. DoP takes a start image (`image_url`), which gives the
mechanism: **the last frame of clip N becomes the start frame of clip N+1**
(extractable with the ffmpeg already used for stitching). Without this the film
is a slideshow of unrelated shots, which is precisely what "AI video looks
cheap" means.

This is why stage 3 is sequential where stages 1 and 2 are parallel — and it
interacts with the provider's 4-at-a-time cap: continuity chains cannot fan out
freely. Re-rendering clip N mid-film also invalidates the start frame of N+1,
so a re-render must offer to carry the change forward.

### Watch it happen, and stop whenever

Rendering is visible clip by clip as it goes, and can be stopped at any point.
This is not a nicety at these prices: a 30-minute film is 180 clips and $270,
and noticing at clip 8 that the look is wrong should cost $12, not $270.

**What a stop actually costs is decided by the provider, not by us.** Verified
2026-08-01: Higgsfield refuses to cancel a submitted job —
`Request is in progress` — and bills it regardless. So the honest rule is:

> Billed for every clip completed, **plus the one currently rendering**,
> because that one is already paid for on our side. Nothing after it.

Stating that up front is the difference between a stop button people trust and
one they suspect. Anything softer would mean absorbing a cost we cannot avoid,
and anything harsher would be charging for work never started.

### Two failure modes, both offered

"Stop on reject" suits someone watching the render; "render all" suits someone
who starts a 30-minute film and comes back later. Both end in the same place —
any single clip can be re-rendered afterwards — so this is a preference about
attention, not about quality.

### Storage follows the purchase

Buying a render includes storage for that film, sized to the file and lasting a
month, so the download window is part of what was paid for rather than a
separate worry. Subscriptions then cover **standing** storage — keeping a
library beyond the included window — which is the honest split: generation is a
variable cost billed per use, storage is a fixed cost billed monthly. See
"Pricing consequence" below.

## What already exists

Most stages exist as parts; what is missing is the gating and the per-item retry.

| Stage | Today | Gap |
|---|---|---|
| 1 beat sheet | Director chat produces a screenplay with per-scene prompts | Not segmented by timecode; no per-segment revise |
| 2 stills | `POST /v1/director/storyboard` renders per-scene previews | No approval; no single-image regenerate |
| 3 clips | Worker renders scene-by-scene | No per-clip review, no per-clip re-render, **no continuity** |
| 4 stitch | Exists in the worker | Only runs on the whole job |
| 5 edit | Editor: captions, fonts, voiceover, filters, trims | Reached separately, not as a pipeline step |
| 6 publish | YouTube upload works | — |

So this is mostly **sequencing and state**, not new generation capability. The
job model has to grow from "queued → generating → done" into a per-segment
state machine that can pause for approval and re-run one item.

## Pricing consequence

Per-item retry means a render is no longer one charge. Charging up front and
refunding pro-rata (today's model) does not survive "re-render clip 14 twice".
Billing has to move to **per-unit, charged as incurred** — which is the
direction the owner already chose for generation, and which the banded
pay-as-you-go pricing in [[0017-pricing-credits-subscriptions]] v3 supports.
Subscriptions then stop bundling generation credits and become storage plans.

## Consequences

- The job schema becomes a segment list with per-segment status, prompt, image
  and clip — a bigger change than any single feature here.
- Approval gates mean jobs can sit idle indefinitely; a paused job holds storage
  and needs an expiry.
- Continuity chains constrain parallelism, so a long film's ETA is not simply
  `scenes / 4 × per-scene` any more. The estimate in `catalog.eta_seconds`
  will need to account for it.
- Good news: every stage before video is cheap enough to iterate freely, which
  is what makes the expensive stage worth gating.

## Related
- Cost and pricing: [[0017-pricing-credits-subscriptions]]
- Generation providers: [[0010-mayo-external-generation-providers]]
- Director: [[0008-mayo-ai-director-scenario-planner]]
- Consistency across scenes: [[0014-character-consistency-and-credits]]
- Service: [[mayo]]
