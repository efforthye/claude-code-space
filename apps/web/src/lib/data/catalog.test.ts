import { describe, expect, it } from "vitest";
import { exhibitionCountdown } from "./catalog";

describe("전시 남은 기간", () => {
  const e = { startDate: "2026-11-10", endDate: "2026-11-15" };
  it("counts days before the start and to the end", () => {
    expect(exhibitionCountdown(e, "2026-11-01")).toBe("9일 뒤 시작");
    expect(exhibitionCountdown(e, "2026-11-09")).toBe("내일 시작");
    expect(exhibitionCountdown(e, "2026-11-10")).toBe("5일 남았어요");
    expect(exhibitionCountdown(e, "2026-11-14")).toBe("내일까지");
    expect(exhibitionCountdown(e, "2026-11-15")).toBe("오늘 마지막 날");
    expect(exhibitionCountdown(e, "2026-11-16")).toBeNull();
  });
});
