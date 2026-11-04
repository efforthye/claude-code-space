import type { Database } from "@/lib/domain/types";

/**
 * 구글 로그인 (OpenID Connect, 인가 코드 + PKCE).
 * 이 파일은 순수 판단만 한다: 구글이 준 신원 정보 검증, 로그인/연결/가입 중 무엇을 할지.
 * 네트워크와 쿠키는 app/auth/google 라우트에서.
 */
export const GOOGLE_ENABLED = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleClaims = {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

/**
 * id_token 내용 검증. 토큰은 TLS로 구글 토큰 엔드포인트에서 직접 받은 것이라 서명 대신
 * 이 확인으로 충분하다 (OIDC Core 3.1.3.7, 6번 항목). 발급자, 받는 쪽, 만료, nonce, 이메일 확인 여부.
 */
export function validateClaims(c: Partial<GoogleClaims>, expected: { clientId: string; nonce: string; now?: number }): c is GoogleClaims & { email: string } {
  const now = (expected.now ?? Date.now()) / 1000;
  return (
    (c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com") &&
    c.aud === expected.clientId &&
    typeof c.sub === "string" &&
    c.sub.length > 0 &&
    typeof c.exp === "number" &&
    c.exp > now &&
    c.nonce === expected.nonce &&
    typeof c.email === "string" &&
    c.email_verified === true
  );
}

/** id_token의 가운데(내용) 부분만 읽는다. 검증은 validateClaims로 */
export function decodeIdToken(idToken: string): Partial<GoogleClaims> {
  const part = idToken.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

export type GoogleDecision =
  | { action: "login"; userId: string }
  | { action: "link"; userId: string }
  | { action: "taken" } // 이 구글 계정이 이미 다른 회원과 연결돼 있다
  | { action: "use-password" } // 같은 이메일의 비밀번호 계정이 있다: 비밀번호로 로그인한 뒤 연결
  | { action: "signup" }; // 처음 온 사람: 출생연도, 약관 동의를 받고 가입

/**
 * 무엇을 할지. 같은 이메일의 기존 계정을 자동으로 합치지 않는다:
 * 누군가 남의 이메일로 먼저 가입해 두는 공격(가입 선점)을 막으려고, 연결은 로그인한 본인만 한다.
 */
export function decideGoogle(db: Pick<Database, "users">, claims: { sub: string; email: string }, currentUserId: string | null): GoogleDecision {
  const bySub = db.users.find((u) => u.googleSub === claims.sub);
  if (currentUserId) {
    if (bySub && bySub.id !== currentUserId) return { action: "taken" };
    return { action: "link", userId: currentUserId };
  }
  if (bySub) return { action: "login", userId: bySub.id };
  if (db.users.some((u) => u.email === claims.email.toLowerCase())) return { action: "use-password" };
  return { action: "signup" };
}
