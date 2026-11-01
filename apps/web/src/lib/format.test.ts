import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatPeriod, formatPrice, formatSize, maskPhone } from "./format";

describe("format", () => {
  it("prices in won with separators", () => expect(formatPrice(1_200_000)).toBe("1,200,000원"));
  it("sizes keep one decimal only when needed", () => {
    expect(formatSize(72.7, 60.6)).toBe("72.7 × 60.6 cm");
    expect(formatSize(48, 82, 52)).toBe("48 × 82 × 52 cm");
  });
  it("renders times in KST regardless of the server timezone", () => {
    // 2026-11-01 15:30 UTC = 2026-11-02 00:30 KST
    expect(formatDateTime("2026-11-01T15:30:00.000Z")).toBe("2026.11.02 00:30");
    expect(formatDate("2026-11-01T15:30:00.000Z")).toBe("2026.11.02");
  });
  it("periods drop the repeated year", () => expect(formatPeriod("2026-11-16", "2026-11-21")).toBe("2026.11.16 – 11.21"));
  it("masks the middle of a phone number", () => expect(maskPhone("010-1234-5678")).toBe("010-****-5678"));
});
