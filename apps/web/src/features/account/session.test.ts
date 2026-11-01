import { describe, expect, it } from "vitest";
import { buildBaseDatabase } from "@/lib/data/base";
import { isLive, openSession, safeNext } from "./session";

const DAY = 24 * 60 * 60 * 1000;

describe("회원 세션", () => {
  it("stores only a hash of a long random token", () => {
    const db = buildBaseDatabase();
    const token = openSession(db, "usr-1", Date.parse("2026-11-01T00:00:00Z"));
    expect(token.length).toBeGreaterThanOrEqual(43); // 256비트
    expect(db.sessions).toHaveLength(1);
    expect(db.sessions[0].tokenHash).not.toContain(token);
    expect(JSON.stringify(db.sessions)).not.toContain(token);
  });
  it("expires after 7 idle days or 30 days in total", () => {
    const start = Date.parse("2026-11-01T00:00:00Z");
    const s = { lastSeenAt: new Date(start).toISOString(), expiresAt: new Date(start + 30 * DAY).toISOString() };
    expect(isLive(s, start + 6 * DAY)).toBe(true);
    expect(isLive(s, start + 8 * DAY)).toBe(false);
    expect(isLive({ ...s, lastSeenAt: new Date(start + 29 * DAY).toISOString() }, start + 31 * DAY)).toBe(false);
  });
  it("sweeps dead sessions when a new one opens", () => {
    const db = buildBaseDatabase();
    const now = Date.parse("2026-11-01T00:00:00Z");
    openSession(db, "usr-old", now - 40 * DAY);
    openSession(db, "usr-new", now);
    expect(db.sessions.map((x) => x.userId)).toEqual(["usr-new"]);
  });
  it("only redirects within the site after login", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/orders/MAYO-ABCD2345")).toBe("/orders/MAYO-ABCD2345");
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext(null)).toBe("/account");
  });
});
