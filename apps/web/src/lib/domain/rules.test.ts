import { describe, expect, it } from "vitest";
import { isMinor, isPaymentOverdue, isUnder14, needsArtShipping, ORDER_NEXT, shippingOptions } from "./rules";
import type { Work } from "./types";

const work = (over: Partial<Work> = {}): Work => ({
  id: "w", title: "t", artistId: "a", exhibitionId: null, medium: "painting", materials: "", widthCm: 50, heightCm: 40,
  depthCm: null, weightKg: null, year: 2026, edition: null, kind: "graduation", price: 100_000, status: "available",
  images: [], description: "", allowsPickup: true, operatorOwned: false, featured: false, createdAt: "", updatedAt: "", ...over,
});

describe("needsArtShipping (가이드 21장 ⑦)", () => {
  it("small painting goes by parcel", () => expect(needsArtShipping(work())).toBe(false));
  it("100cm on any side needs art shipping", () => {
    expect(needsArtShipping(work({ heightCm: 100 }))).toBe(true);
    expect(needsArtShipping(work({ depthCm: 120 }))).toBe(true);
    expect(needsArtShipping(work({ widthCm: 99.9 }))).toBe(false);
  });
  it("20kg or heavier needs art shipping", () => {
    expect(needsArtShipping(work({ weightKg: 20 }))).toBe(true);
    expect(needsArtShipping(work({ weightKg: 19.9 }))).toBe(false);
  });
  it("sculpture and furniture always do, whatever the size", () => {
    expect(needsArtShipping(work({ medium: "sculpture", widthCm: 10, heightCm: 10 }))).toBe(true);
    expect(needsArtShipping(work({ medium: "furniture", widthCm: 30, heightCm: 40 }))).toBe(true);
  });
});

describe("shippingOptions", () => {
  it("offers pickup only when the artist allows it", () => {
    expect(shippingOptions(work())).toEqual(["parcel", "pickup"]);
    expect(shippingOptions(work({ allowsPickup: false }))).toEqual(["parcel"]);
    expect(shippingOptions(work({ medium: "sculpture" }))).toEqual(["art_shipping", "pickup"]);
  });
});

describe("age checks count conservatively from birth year", () => {
  // 생일 전이라고 가정: 만 나이 = 올해 − 출생연도 − 1
  const now = new Date("2026-11-01");
  it("born 2007 may still be 18 → minor (needs guardian)", () => expect(isMinor(2007, now)).toBe(true));
  it("born 2006 is at least 19 → adult", () => expect(isMinor(2006, now)).toBe(false));
  it("born 2012 may still be 13 → refused", () => expect(isUnder14(2012, now)).toBe(true));
  it("born 2011 is at least 14 → accepted", () => expect(isUnder14(2011, now)).toBe(false));
});

describe("order flow", () => {
  it("closed states have no exits", () => {
    expect(ORDER_NEXT.completed).toEqual([]);
    expect(ORDER_NEXT.cancelled).toEqual([]);
  });
  it("payment can only be confirmed from pending", () => {
    for (const [from, next] of Object.entries(ORDER_NEXT)) {
      if (from !== "pending_payment") expect(next).not.toContain("paid");
    }
  });
  it("flags only pending orders past their due time", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isPaymentOverdue({ status: "pending_payment", paymentDueAt: past })).toBe(true);
    expect(isPaymentOverdue({ status: "pending_payment", paymentDueAt: future })).toBe(false);
    expect(isPaymentOverdue({ status: "paid", paymentDueAt: past })).toBe(false);
  });
});
