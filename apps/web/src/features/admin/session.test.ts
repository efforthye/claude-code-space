import { afterEach, describe, expect, it, vi } from "vitest";

const load = async () => {
  vi.resetModules();
  return import("./session");
};

describe("admin session", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed in production without a secret — no throw, no login", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "anything");
    const s = await load();
    expect(s.ADMIN_ENABLED).toBe(false);
    expect(s.checkPassword("anything")).toBe(false);
    expect(s.isValidSession("9999999999.whatever")).toBe(false);
  });

  it("signs sessions that verify, and rejects tampered or expired ones", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", "x".repeat(40));
    vi.stubEnv("ADMIN_PASSWORD", "correct horse");
    const s = await load();
    expect(s.checkPassword("correct horse")).toBe(true);
    expect(s.checkPassword("wrong")).toBe(false);
    const { value } = s.issueSessionValue();
    expect(s.isValidSession(value)).toBe(true);
    const [exp, mac] = value.split(".");
    expect(s.isValidSession(`${Number(exp) + 1}.${mac}`)).toBe(false); // extended expiry, old MAC
    expect(s.isValidSession(`1.${mac}`)).toBe(false);
  });
});
