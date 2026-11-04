import { describe, expect, it } from "vitest";
import { decideGoogle, decodeIdToken, validateClaims } from "./google";

const base = { iss: "https://accounts.google.com", aud: "cid", sub: "g-1", exp: 2_000_000_000, nonce: "n1", email: "a@gmail.com", email_verified: true };

describe("구글 로그인 판단", () => {
  it("accepts only Google-issued, unexpired tokens for this app with the right nonce and a verified email", () => {
    const ok = (c: object) => validateClaims({ ...base, ...c }, { clientId: "cid", nonce: "n1", now: 1_900_000_000_000 });
    expect(ok({})).toBe(true);
    expect(ok({ iss: "https://evil.example" })).toBe(false);
    expect(ok({ aud: "other-app" })).toBe(false);
    expect(ok({ exp: 1_800_000_000 })).toBe(false);
    expect(ok({ nonce: "replayed" })).toBe(false);
    expect(ok({ email_verified: false })).toBe(false);
    expect(ok({ sub: "" })).toBe(false);
  });

  it("reads the payload of an id_token", () => {
    const token = ["x", Buffer.from(JSON.stringify(base)).toString("base64url"), "sig"].join(".");
    expect(decodeIdToken(token).sub).toBe("g-1");
    expect(decodeIdToken("garbage")).toEqual({});
  });

  it("logs in a linked member, links only for the signed-in member, never merges by email", () => {
    const users = [
      { id: "u1", email: "a@gmail.com", googleSub: null },
      { id: "u2", email: "b@gmail.com", googleSub: "g-2" },
    ] as never;
    expect(decideGoogle({ users }, { sub: "g-2", email: "b@gmail.com" }, null)).toEqual({ action: "login", userId: "u2" });
    // 같은 이메일의 비밀번호 계정: 자동으로 합치지 않는다
    expect(decideGoogle({ users }, { sub: "g-1", email: "a@gmail.com" }, null)).toEqual({ action: "use-password" });
    // 로그인한 본인이 연결
    expect(decideGoogle({ users }, { sub: "g-1", email: "a@gmail.com" }, "u1")).toEqual({ action: "link", userId: "u1" });
    // 이미 다른 회원과 연결된 구글 계정은 연결할 수 없다
    expect(decideGoogle({ users }, { sub: "g-2", email: "b@gmail.com" }, "u1")).toEqual({ action: "taken" });
    expect(decideGoogle({ users }, { sub: "g-9", email: "new@gmail.com" }, null)).toEqual({ action: "signup" });
  });
});
