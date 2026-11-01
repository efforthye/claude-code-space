import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

describe("비밀번호", () => {
  it("hashes with scrypt N=2^17 and a fresh salt, and verifies only the right password", async () => {
    const a = await hashPassword("긴 문장처럼 쓴 비밀번호 2026");
    const b = await hashPassword("긴 문장처럼 쓴 비밀번호 2026");
    expect(a).toMatch(/^scrypt\$17\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(a).not.toBe(b); // 같은 비밀번호도 저장값은 다르다
    expect(await verifyPassword("긴 문장처럼 쓴 비밀번호 2026", a)).toBe(true);
    expect(await verifyPassword("긴 문장처럼 쓴 비밀번호 2025", a)).toBe(false);
    expect(await verifyPassword("anything", "md5$abc")).toBe(false);
  });
  it("treats composed and decomposed Hangul as the same password", async () => {
    const h = await hashPassword("한글비밀번호입니다");
    expect(await verifyPassword("한글비밀번호입니다".normalize("NFD"), h)).toBe(true);
  });
  it("asks for length, not character classes, and blocks the obvious ones", () => {
    expect(passwordProblem("short", "a@b.com")).toMatch(/10자/);
    expect(passwordProblem("onlylowercaseletters", "a@b.com")).toBeNull();
    expect(passwordProblem("1234567890", "a@b.com")).toMatch(/흔한/);
    expect(passwordProblem("zzzzzzzzzzzz", "a@b.com")).toMatch(/흔한/);
    expect(passwordProblem("hyerim-2026-mayo", "hyerim@example.com")).toMatch(/이메일/);
    expect(passwordProblem("x".repeat(129), "a@b.com")).toMatch(/128자/);
  });
});
