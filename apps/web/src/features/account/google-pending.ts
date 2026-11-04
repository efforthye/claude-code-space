import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { store } from "@/lib/data/store";

/** 가입 마무리 화면에 보여 줄 이메일, 이름 (쿠키의 토큰으로). 서버 액션이 아니라 화면에서만 부른다 */
export async function pendingGoogleSignup() {
  const token = (await cookies()).get("mayo_google_signup")?.value;
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("base64url");
  const p = ((await store.read()).oauthPending ?? []).find((x) => x.tokenHash === hash && Date.parse(x.expiresAt) > Date.now());
  return p ? { email: p.email, name: p.name } : null;
}
