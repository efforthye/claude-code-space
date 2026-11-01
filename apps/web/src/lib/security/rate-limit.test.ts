import { beforeEach, describe, expect, it } from "vitest";
import { blocked, hit, resetRateLimits } from "./rate-limit";

describe("rate limit", () => {
  beforeEach(resetRateLimits);
  it("allows up to the limit inside a window, then blocks", () => {
    const t = 1_000_000;
    expect([1, 2, 3].map(() => hit("k", 3, 60_000, t))).toEqual([true, true, true]);
    expect(hit("k", 3, 60_000, t + 10)).toBe(false);
  });
  it("opens again when the window passes", () => {
    const t = 2_000_000;
    for (let i = 0; i < 4; i++) hit("k", 3, 1000, t);
    expect(hit("k", 3, 1000, t + 1001)).toBe(true);
  });
  it("keys are independent", () => {
    const t = 3_000_000;
    for (let i = 0; i < 5; i++) hit("a", 1, 1000, t);
    expect(hit("b", 1, 1000, t)).toBe(true);
  });
});

describe("blocked (count only failures)", () => {
  beforeEach(resetRateLimits);
  it("is not blocked until failures reach the limit", () => {
    const t = 4_000_000;
    for (let i = 0; i < 4; i++) hit("f", 5, 1000, t);
    expect(blocked("f", 5, t)).toBe(false);
    hit("f", 5, 1000, t);
    expect(blocked("f", 5, t)).toBe(true);
    expect(blocked("f", 5, t + 1001)).toBe(false);
  });
});
