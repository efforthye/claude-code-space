import type { Auction, AuctionBid, AuctionMax, ID } from "./types";

/**
 * 경매 규칙. 저장소와 화면 없이 경매 객체만 바꾸는 순수 함수라 테스트로 고정한다.
 *
 * 대리 입찰(자동입찰): 입찰자는 최대 금액만 정하고, 현재가는 "2등의 최대 금액 + 입찰 단위"
 * (1등의 최대 금액을 넘지 않게)로 정해진다. 최대 금액이 같으면 먼저 정한 사람이 이긴다.
 * eBay의 proxy bidding, Catawiki의 자동입찰과 같은 방식. wiki/concepts/online-auction-mechanics 참고.
 */

/** 마지막 이만큼 안에 입찰이 들어오면 */
export const SNIPE_WINDOW_MS = 60_000;
/** 마감을 지금부터 이만큼 뒤로 미룬다 */
export const SNIPE_EXTEND_MS = 90_000;
/** 순차 마감 간격 (작품마다 2분) */
export const STAGGER_MS = 2 * 60_000;
/** 차순위 입찰자가 구매 제안에 답할 시간 */
export const OFFER_HOURS = 24;
/** 낙찰 후 미결제가 이만큼 쌓이면 입찰할 수 없다 */
export const STRIKE_LIMIT = 2;
/** 한 번에 받을 수 있는 최대 금액 (오타로 0을 더 붙이는 사고 방지) */
export const MAX_BID = 100_000_000;

export type AuctionPhase = "requested" | "upcoming" | "live" | "ended" | "cancelled";

export function auctionPhase(a: Pick<Auction, "state" | "startsAt" | "endsAt">, now: number): AuctionPhase {
  if (a.state === "requested" || a.state === "cancelled") return a.state;
  if (a.state === "closed" || now >= Date.parse(a.endsAt)) return "ended";
  if (now < Date.parse(a.startsAt)) return "upcoming";
  return "live";
}

/** 최대 금액 순, 같으면 먼저 정한 순 */
export function rankMaxes(maxes: AuctionMax[]): AuctionMax[] {
  return [...maxes].sort((a, b) => b.max - a.max || a.at.localeCompare(b.at));
}

/** 지금 이기고 있는 사람과 현재가 */
export function standing(a: Pick<Auction, "maxes" | "startPrice" | "increment">): { leader: ID | null; price: number } {
  const [first, second] = rankMaxes(a.maxes);
  if (!first) return { leader: null, price: a.startPrice };
  if (!second) return { leader: first.userId, price: a.startPrice };
  return { leader: first.userId, price: Math.max(a.startPrice, Math.min(first.max, second.max + a.increment)) };
}

/** 다음에 받을 수 있는 최소 입찰가 */
export function minimumBid(a: Pick<Auction, "maxes" | "startPrice" | "increment">): number {
  const { leader, price } = standing(a);
  return leader ? price + a.increment : a.startPrice;
}

export type BidError =
  | "not_live"
  | "too_low"
  | "too_high"
  | "not_raised" // 이미 1등인 사람이 최대 금액을 올리지 않음
  | "over_buy_now"; // 즉시구매가 이상이면 즉시구매로

export type BidOutcome =
  | { ok: false; error: BidError; minimum: number }
  | { ok: true; leading: boolean; price: number; outbid: ID | null; extended: boolean };

/**
 * 최대 금액을 정한다 (한 번 입찰도 "최대 금액 = 그 금액"인 대리 입찰과 같다).
 * a를 그 자리에서 바꾼다. 화면에 보일 입찰 줄(bids)도 여기서 쌓는다.
 */
export function placeMax(a: Auction, userId: ID, max: number, now: number, newId: () => ID): BidOutcome {
  const minimum = minimumBid(a);
  if (auctionPhase(a, now) !== "live") return { ok: false, error: "not_live", minimum };
  if (!Number.isInteger(max) || max > MAX_BID) return { ok: false, error: "too_high", minimum };
  if (a.buyNowPrice != null && max >= a.buyNowPrice) return { ok: false, error: "over_buy_now", minimum };

  const before = standing(a);
  const mine = a.maxes.find((m) => m.userId === userId);
  if (before.leader === userId) {
    if (!mine || max <= mine.max) return { ok: false, error: "not_raised", minimum };
  } else if (max < minimum) {
    return { ok: false, error: "too_low", minimum };
  }

  const at = new Date(now).toISOString();
  if (mine) {
    mine.max = max;
    mine.at = at;
  } else {
    a.maxes.push({ userId, max, at });
  }

  const after = standing(a);
  const line = (uid: ID, amount: number, auto: boolean): AuctionBid => ({ id: newId(), userId: uid, amount, at, auto });
  if (after.leader !== before.leader || after.price !== before.price) {
    // 1등이 바뀌었거나 값이 올랐다. 진 쪽이 낸 마지막 금액, 이긴 쪽의 현재가 순서로 남긴다.
    const [, second] = rankMaxes(a.maxes);
    if (second && second.max > before.price) {
      a.bids.push(line(second.userId, second.max, second.userId !== userId));
    }
    a.bids.push(line(after.leader!, after.price, after.leader !== userId));
  }

  let extended = false;
  const end = Date.parse(a.endsAt);
  if (end - now <= SNIPE_WINDOW_MS) {
    a.endsAt = new Date(Math.max(end, now + SNIPE_EXTEND_MS)).toISOString();
    extended = true;
  }
  a.updatedAt = at;
  const outbid = before.leader && before.leader !== after.leader ? before.leader : null;
  return { ok: true, leading: after.leader === userId, price: after.price, outbid, extended };
}

/** 즉시구매가 남아 있는가: 현재가가 즉시구매가에 닿기 전까지만 */
export function canBuyNow(a: Pick<Auction, "buyNowPrice" | "maxes" | "startPrice" | "increment">): boolean {
  return a.buyNowPrice != null && standing(a).price < a.buyNowPrice;
}

/** 마감 결과: 1등과 낙찰가, 입찰이 없으면 null (유찰) */
export function hammer(a: Pick<Auction, "maxes" | "startPrice" | "increment">): { userId: ID; amount: number } | null {
  const { leader, price } = standing(a);
  return leader ? { userId: leader, amount: price } : null;
}

/**
 * 차순위: 결제하지 않은 사람을 빼고 다음으로 높은 사람에게 그 사람의 최대 금액으로 제안한다
 * (eBay Second Chance Offer와 같다. 본인이 낼 수 있다고 정한 금액 안이다).
 */
export function nextBidder(a: Pick<Auction, "maxes" | "failedUserIds">, exclude: ID[] = []): AuctionMax | null {
  const skip = new Set([...a.failedUserIds, ...exclude]);
  return rankMaxes(a.maxes).find((m) => !skip.has(m.userId)) ?? null;
}

/** 구매 수수료 (원 단위 반올림) */
export function buyerFee(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

/** KST 날짜와 시각을 ISO로 ("2026-11-15", "18:00") */
export function kstToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

/**
 * 마지막 날 순차 마감: 첫 작품은 그날 first(기본 18:00, KST)에, 이후 2분 간격.
 * 관심작이 같은 시각에 몰려 끝나지 않게 한다 (Catawiki 방식).
 */
export function staggeredEnds(lastDay: string, count: number, first = "18:00"): string[] {
  const start = Date.parse(kstToIso(lastDay, first));
  return Array.from({ length: count }, (_, i) => new Date(start + i * STAGGER_MS).toISOString());
}

/** 공개 화면용 입찰자 이름: 처음 입찰한 순서대로 "입찰자 1, 2 …" (회원 정보는 내보내지 않는다) */
export function bidderAliases(a: Pick<Auction, "bids" | "maxes">): Map<ID, string> {
  const order: ID[] = [];
  for (const b of [...a.bids].sort((x, y) => x.at.localeCompare(y.at))) if (!order.includes(b.userId)) order.push(b.userId);
  for (const m of a.maxes) if (!order.includes(m.userId)) order.push(m.userId);
  return new Map(order.map((id, i) => [id, `입찰자 ${i + 1}`]));
}
