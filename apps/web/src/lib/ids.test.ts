import { describe, expect, it } from "vitest";
import { newOrderCode, newTrackingCode } from "./ids";

describe("codes", () => {
  it("order codes avoid look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(newOrderCode()).toMatch(/^MAYO-[2-9A-HJ-NP-Z]{8}$/);
  });
  it("tracking codes carry their kind", () => {
    expect(newTrackingCode("J")).toMatch(/^J-[2-9A-HJ-NP-Z]{8}$/);
    expect(newTrackingCode("Q")).toMatch(/^Q-/);
  });
  it("does not repeat in practice", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => newOrderCode()));
    expect(seen.size).toBe(2000);
  });
});
