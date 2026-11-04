import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser, safeNext } from "@/features/account/session";
import { GOOGLE_AUTH_URL, GOOGLE_ENABLED } from "@/features/account/google";
import { allow } from "@/lib/security/rate-limit";

export const OAUTH_COOKIE = "mayo_oauth";

/**
 * 구글 로그인 시작: state(요청 위조 방지), PKCE(코드 가로채기 방지), nonce(토큰 재사용 방지)를 만들어
 * 10분짜리 쿠키에 넣고 구글로 보낸다. ?link=1 이면 로그인한 회원의 계정에 구글을 연결한다.
 */
export async function GET(req: Request) {
  if (!GOOGLE_ENABLED) redirect("/login?google=off");
  if (!(await allow("google-start", 30, 10 * 60_000))) redirect("/login?google=busy");
  const url = new URL(req.url);
  const link = url.searchParams.get("link") === "1";
  if (link && !(await currentUser())) redirect("/login?next=/account/settings");

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const next = safeNext(url.searchParams.get("next"));
  (await cookies()).set(OAUTH_COOKIE, Buffer.from(JSON.stringify({ state, verifier, nonce, next, link })).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // 구글에서 돌아오는 이동에도 쿠키가 실려야 한다
    path: "/auth/google",
    maxAge: 600,
  });

  const auth = new URL(GOOGLE_AUTH_URL);
  auth.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: new URL("/auth/google/callback", url).toString(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  redirect(auth.toString());
}
