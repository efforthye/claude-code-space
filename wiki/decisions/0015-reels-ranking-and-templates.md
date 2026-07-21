---
title: "ADR 0015: Reels ranking (engagement × time decay) + public templates"
type: decision
status: live
tags: [mayo, explore, ranking, algorithm]
created: 2026-07-17
updated: 2026-07-17
---

# ADR 0015: Reels ranking — engagement × time decay — and public templates

## Context

The Explore tab became a full reels feed. Its "popular" sort was ad-hoc
(`likes*3 + comments*2 + index-freshness`), with no real timestamps, no view
counts, and a tendency to freeze on early winners. The owner asked for a
ranking grounded in published algorithm research, and for every published reel
to be reusable as a template by other users.

## Research consulted

- **Industrial short-video ranking (TikTok-style)**: the final score is a
  weighted sum of predicted engagement values, `Score = Σ P_task × V_task`,
  where watch/completion dominates and deep actions (shares/saves/comments)
  outweigh shallow ones (likes, views).
- **Hacker News gravity**: `(P−1)/(T+2)^G` (G≈1.8) — an item's score is its
  engagement divided by a power of its age, so everything decays and the front
  page stays fresh.
- **Reddit hot**: `log10(votes) + sign·t/45000` — logarithmic engagement with a
  linear recency term.
- **YouTube (Covington et al. 2016)**: rank by *expected watch time* rather
  than clicks — the reason watch signals matter most.

## Decision

`ExploreStore._score` (mayo-api `store.py`):

```
score = (likes×3 + comments×5 + shares×8 + watches×1.5 + views×0.3 + 1) / (age_hours + 2)^1.5
```

- **Signal weights** follow the industrial ordering: shares (deepest — the
  user vouches for the content outside the app) > comments > likes > views
  (shallow impressions). Views come from an app-side impression ping
  (`POST /v1/explore/{id}/view`) when a reel becomes the active page; shares
  from a completion ping (`POST /v1/explore/{id}/share`) after the OS share
  sheet succeeds (the app hands the actual mp4 to the sheet, so recipients
  need no mayo account). Watch-completion is the acknowledged missing signal —
  the next upgrade once the player reports position.
- **HN-form decay** with a softer gravity (1.5 vs 1.8) because the feed is
  small; the `+2` hour offset stops brand-new items from having infinite score.
- **`+1` numerator floor** gives zero-engagement new items a real score while
  fresh (cold-start), then they fade unless they earn engagement — the
  "frozen early winners" failure mode is gone structurally.
- `ExploreItem` gains `views` and `createdAt` (legacy rows are backfilled with
  staggered timestamps preserving their stored order).

**Templates**: publishing a video now copies its full generation recipe
(`scenePrompts`, `stylePrompt` — the ADR 0014 consistency block) onto the
explore item. The reel's "use this template" button opens the AI director with
that recipe as hidden context (same mechanism as revision mode), so anyone can
make their own variation of a public creation. `GET /v1/explore/{id}` serves
the single item with its recipe.

## Consequences

- Ranking is recomputed per request (cheap at this scale); scores decay
  continuously without a cron.
- Impression counts are honest but unauthenticated — inflation by refresh is
  possible; acceptable now, rate-limit later if it's gamed.
- Published recipes are public by design — publishing means sharing the how,
  not just the result. The publish flow should say so if this ever surprises
  users.

Sources: [Hacker News ranking](https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d),
[HN scoring deep-dive](http://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html),
[TikTok ranking guides](https://buffer.com/resources/tiktok-algorithm/),
[TikTok engagement study, CHI 2024](https://dl.acm.org/doi/10.1145/3613904.3642433).

Related: [[mayo]], [[mayo-api]], [[0014-character-consistency-and-credits]].

## Update 2026-07-21 — completion-rate signal

`watches` counts COMPLETED plays (the app pings `POST /v1/explore/{id}/watch`
once per activation when the reel plays to its end — `playToEnd` from the
player; the anonymous web mirror is `/v1/public/explore/{id}/watch`). Weighted
1.5: deeper than a view (0.3), shallower than a like (3) — completion rate is a
core signal in industrial short-video rankers.
