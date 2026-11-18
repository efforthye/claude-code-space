import { describe, expect, it } from "vitest";
import { auctionPhase, bidderAliases, buyerFee, canBuyNow, hammer, minimumBid, nextBidder, placeMax, staggeredEnds, standing } from "./auction";
import type { Auction } from "./types";

const T0 = Date.parse("2026-11-09T01:00:00Z");
const END = Date.parse("2026-11-15T09:00:00Z");
let n = 0;
const id = () => `b${++n}`;

function auction(over: Partial<Auction> = {}): Auction {
  return {
    id: "auc-1",
    workId: "w-1",
    exhibitionId: null,
    startPrice: 50_000,
    increment: 10_000,
    buyNowPrice: 350_000,
    startsAt: new Date(T0).toISOString(),
    endsAt: new Date(END).toISOString(),
    originalEndsAt: new Date(END).toISOString(),
    state: "scheduled",
    requestedBy: "admin",
    bids: [],
    maxes: [],
    result: null,
    failedUserIds: [],
    offer: null,
    createdAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    ...over,
  };
}

const at = (minutes: number) => T0 + minutes * 60_000;

describe("proxy bidding", () => {
  it("the first bid opens at the start price, whatever the max", () => {
    const a = auction();
    const r = placeMax(a, "u1", 300_000, at(1), id);
    expect(r).toMatchObject({ ok: true, leading: true, price: 50_000 });
    expect(a.bids.map((b) => b.amount)).toEqual([50_000]);
  });

  it("a lower challenger is outbid automatically, one step above their max", () => {
    const a = auction();
    placeMax(a, "u1", 300_000, at(1), id);
    const r = placeMax(a, "u2", 240_000, at(2), id);
    expect(r).toMatchObject({ ok: true, leading: false, price: 250_000, outbid: null });
    expect(a.bids.slice(-2).map((b) => [b.userId, b.amount, b.auto])).toEqual([
      ["u2", 240_000, false],
      ["u1", 250_000, true],
    ]);
  });

  it("a higher challenger takes the lead at the old leader's max plus a step", () => {
    const a = auction();
    placeMax(a, "u1", 200_000, at(1), id);
    const r = placeMax(a, "u2", 300_000, at(2), id);
    expect(r).toMatchObject({ ok: true, leading: true, price: 210_000, outbid: "u1" });
  });

  it("equal maxes: the earlier one wins, at that amount", () => {
    const a = auction();
    placeMax(a, "u1", 200_000, at(1), id);
    placeMax(a, "u2", 200_000, at(2), id);
    expect(standing(a)).toEqual({ leader: "u1", price: 200_000 });
  });

  it("rejects bids under the minimum, and a leader who does not raise", () => {
    const a = auction();
    placeMax(a, "u1", 100_000, at(1), id);
    expect(minimumBid(a)).toBe(60_000);
    expect(placeMax(a, "u2", 55_000, at(2), id)).toMatchObject({ ok: false, error: "too_low", minimum: 60_000 });
    expect(placeMax(a, "u1", 90_000, at(3), id)).toMatchObject({ ok: false, error: "not_raised" });
    // 1등이 최대 금액만 올리면 현재가는 그대로, 공개 입찰 줄도 생기지 않는다
    const lines = a.bids.length;
    expect(placeMax(a, "u1", 150_000, at(4), id)).toMatchObject({ ok: true, price: 50_000 });
    expect(a.bids.length).toBe(lines);
  });

  it("refuses bids before the start, after the end, and at or over the buy-now price", () => {
    const a = auction();
    expect(placeMax(a, "u1", 60_000, T0 - 1, id)).toMatchObject({ ok: false, error: "not_live" });
    expect(placeMax(a, "u1", 60_000, END, id)).toMatchObject({ ok: false, error: "not_live" });
    expect(placeMax(a, "u1", 350_000, at(1), id)).toMatchObject({ ok: false, error: "over_buy_now" });
  });
});

describe("closing", () => {
  it("a bid in the last minute pushes the end to 90 seconds from now", () => {
    const a = auction();
    const now = END - 30_000;
    const r = placeMax(a, "u1", 60_000, now, id);
    expect(r).toMatchObject({ ok: true, extended: true });
    expect(Date.parse(a.endsAt)).toBe(now + 90_000);
    expect(a.originalEndsAt).toBe(new Date(END).toISOString());
  });

  it("a bid earlier than that leaves the end alone", () => {
    const a = auction();
    expect(placeMax(a, "u1", 60_000, END - 120_000, id)).toMatchObject({ extended: false });
    expect(Date.parse(a.endsAt)).toBe(END);
  });

  it("phases follow the clock", () => {
    const a = auction();
    expect(auctionPhase(a, T0 - 1)).toBe("upcoming");
    expect(auctionPhase(a, T0)).toBe("live");
    expect(auctionPhase(a, END)).toBe("ended");
    expect(auctionPhase({ ...a, state: "requested" }, T0)).toBe("requested");
  });

  it("hammer goes to the leader; no bids means no sale", () => {
    const a = auction();
    expect(hammer(a)).toBeNull();
    placeMax(a, "u1", 300_000, at(1), id);
    placeMax(a, "u2", 120_000, at(2), id);
    expect(hammer(a)).toEqual({ userId: "u1", amount: 130_000 });
  });

  it("buy-now disappears once the price reaches it", () => {
    const a = auction({ buyNowPrice: 100_000 });
    expect(canBuyNow(a)).toBe(true);
    placeMax(a, "u1", 99_000, at(1), id);
    placeMax(a, "u2", 95_000, at(2), id);
    expect(standing(a).price).toBe(99_000);
    expect(canBuyNow(a)).toBe(true);
    expect(canBuyNow({ ...a, buyNowPrice: 99_000 })).toBe(false);
  });

  it("second chance skips people who did not pay", () => {
    const a = auction();
    placeMax(a, "u3", 150_000, at(1), id);
    placeMax(a, "u1", 300_000, at(2), id);
    placeMax(a, "u2", 200_000, at(3), id);
    a.failedUserIds.push("u1");
    expect(nextBidder(a)).toMatchObject({ userId: "u2", max: 200_000 });
    expect(nextBidder(a, ["u2"])).toMatchObject({ userId: "u3" });
  });

  it("staggers the last-day closing two minutes apart from 18:00 KST", () => {
    expect(staggeredEnds("2026-11-15", 3)).toEqual(["2026-11-15T09:00:00.000Z", "2026-11-15T09:02:00.000Z", "2026-11-15T09:04:00.000Z"]);
  });
});

describe("display", () => {
  it("fees round to the won", () => {
    expect(buyerFee(255_555, 0.1)).toBe(25_556);
  });

  it("bidders get stable aliases in order of first appearance", () => {
    const a = auction();
    placeMax(a, "u9", 300_000, at(1), id);
    placeMax(a, "u4", 100_000, at(2), id);
    const alias = bidderAliases(a);
    expect(alias.get("u9")).toBe("입찰자 1");
    expect(alias.get("u4")).toBe("입찰자 2");
  });
});
