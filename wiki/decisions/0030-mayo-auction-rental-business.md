---
title: "ADR 0030: 졸전 경매, 작품 렌탈, 기업전용관"
type: decision
status: live
tags: [web, mayo, auction, rental, b2b, legal]
created: 2026-11-18
updated: 2026-11-18
---

# ADR 0030: 졸전 경매, 작품 렌탈, 기업전용관

## Context
The team settled the business model in a class session (notes the owner pasted on 2026-11-18,
plus two slides "MAYO 경매 화면" and "MAYO 경매 운영 방식"). Ideas marked as confirmed:
- **Auction during the graduation show only** ("라이브 경매!!!", 7일 경매): bid on the day you see
  the show, close fairly.
- **Rental** ("렌탈!!!!!/대여", "렌탈도 우리 수익"): rent before you buy; curation for people
  who do not know what fits their space.
- **기업전용관** (top-right link): B2B rental for shops and offices, company-space exhibitions,
  corporate purchase and gifts, commissions, hiring artists.
- **50만 원 이하**, gift giving (집들이 선물), packaging as an optional paid service.

## Decision
Build all of it inside [[web]] on the existing `Store` seam ([[0029-mongodb-atlas-store]]).

**Auction** (`src/lib/domain/auction.ts`, `src/features/auction/`):
- Proxy bidding: a bidder sets a max; the price is the second max plus one increment, capped
  at the leader's max; equal maxes go to the earlier one. Same as eBay proxy bidding.
- Anti-sniping: a bid in the last 60 s moves the end to now + 90 s (slide).
- Staggered close on the last day from 18:00 KST, 2 minutes apart (Catawiki-style).
- Buy-now stays available until the price reaches it.
- The winner gets a bank-transfer order with the buyer fee (admin-set, default 10%) and 48 h to
  pay. If they do not pay, they get a strike (2 strikes block bidding) and the next bidder is
  offered their own max for 24 h (eBay Second Chance Offer).
- Closing is lazy: every auction read calls `settleDueAuctions()`, because serverless has no
  always-on scheduler and Vercel Hobby cron runs only daily. The live panel polls
  `/api/auctions/[id]` every 5 s (2 s in the last 2 minutes) instead of using websockets.

**Legal** (미술진흥법 제15조⑤, in force since 2026-07-26 with the 신고제):
- ⑤2: hammer price and payment status are disclosed automatically at `/auctions/results`,
  with no buyer identity.
- ⑤3: no self-bidding. Staff accounts (`MAYO_STAFF_EMAILS`) and the work's own artist cannot bid.
- ⑤4: an operator- or relative-owned work (`operatorOwned`) shows a notice before bidding.
- Minors' contracts can be cancelled (민법 제5조), so bidders must be 19+ and have a phone number.
- Terms at `/legal/auction`: contract forms at the hammer, 7-day 청약철회 kept, and records are
  kept 5 years (전자상거래법).
- The owner must also file **미술품 경매업** in addition to 대여·판매업 before opening
  auctions; see the admin compliance page.

**Rental**:
- `work.rentable` is the artist's consent. Monthly fee is 3% of the price (minimum ₩10,000),
  deposit is 30%, and rent-to-own credits 50% of the rent paid. These are placeholder values in
  `rules.ts`.
- Flow: requested → confirmed (the work is held as reserved) → active → returned, or purchased
  (makes a pending order with the credit taken off). Rentals can also be cancelled.

**기업전용관** (`/business`): services, steps, rentable shortlist and a consultation form that
covers rental, exhibition, purchase, commission and hire. Personal curation ("추천 받기") lives
on `/rental`. Both go to `db.consultations`, and admin answers show in 마이페이지 and by mail.

**Checkout**: packaging choice (basic free, gift ₩5,000, art crate ₩30,000 per work) and a gift
option (recipient, card message, hide price).

## Options considered
- **Websockets or SSE for live bids:** not chosen. Serverless connections are costly, and polling
  is enough at hundreds of works per season.
- **Card pre-authorisation for winners** (the slide's "사전 등록 카드"): deferred until a PG is
  connected. Bank transfer with a 48 h due time and strikes is used for now.
- **Web Push outbid alerts:** deferred because they need VAPID keys and a service worker. Email
  plus an in-page toast is used now.

## Consequences
- **Fees:** the auction buyer fee and the packaging fees are revenue lines, configurable without
  a deploy (fee) or in `rules.ts` (packaging). The team still has to confirm the rates.
- **One document:** all bids live in the single Mongo state document. That is fine for a season;
  move bids to their own collection if a season passes ~10k bids.
- **Owner actions:**
  - File 미술품 경매업 신고.
  - Set `MAYO_STAFF_EMAILS`.
  - Confirm the fee rates.
  - Get a lawyer to review `/legal/auction`.

## Sources
- 미술진흥법 제2조, 제15조, 제16조, 제33조 (law.go.kr). Read on 2026-11-18.
- "미술서비스업 신고제 7월 26일부터 시행", m.news.nate.com/view/20260724n22031.
- Korea Art News, "미술서비스업 신고제 지금부터 준비해야 합니다", koreaartnews.com/post/rVSV6Ivv.
- 공정위 전자상거래법 결정 (미성년자 취소권 고지, 청약철회 기간), law.go.kr/LSW/ftcInfoP.do.
- [[online-auction-mechanics]] for the mechanism references.
