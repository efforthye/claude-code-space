---
title: Online auction mechanics
type: concept
tags: [auction, mayo, reference]
created: 2026-11-18
updated: 2026-11-18
---

# Online auction mechanics

Reference notes behind the MAYO auction ([[0030-mayo-auction-rental-business]]).

## Proxy bidding (eBay, Catawiki)
- The bidder enters the most they will pay. The system bids for them one increment at a time.
- Current price = min(leader's max, runner-up's max + increment), and never below the start price.
- On a tie, the earlier max wins. Ties are why the timestamp is stored with each max.
- Only the bidder sees their own max. Leaking maxes lets others bid to just below them.
- A leader raising their own max does not move the price and should not create a visible bid
  line. Otherwise the leader looks like they are bidding against themselves.

## Anti-sniping (soft close)
- **Fixed close (eBay):** rewards last-second sniping tools.
- **Soft close (Catawiki, many art houses):** a bid in the final minute extends the end. MAYO
  extends to now + 90 s.
- **Staggered closing:** lots end a couple of minutes apart, so a bidder chasing several works
  is not forced to choose at one instant.

## Second chance
- If the winner does not pay, the platform may offer the item to the next bidder at that
  bidder's own highest bid (eBay Second Chance Offer).
- That amount is within what the next bidder already agreed to pay.

## Korean law touchpoints
- **미술진흥법 제15조⑤** (경매업자):
  - Disclose hammer prices and whether payment was completed.
  - Do not bid in your own auction.
  - Give prior notice when the operator or a relative owns the work.
- **미술진흥법 제18조, 제33조:** not filing 미술품 경매업 is a fine of up to ₩5,000,000. There was a
  one-year guidance period from 2026-07-26.
- **민법 제5조:** a minor's contract without guardian consent is voidable, so auctions are 19+.
- **전자상거래법:**
  - The intermediary must disclose that it is not the party to the trade.
  - Contract records are kept for 5 years.
  - 청약철회 periods may not be shortened.
