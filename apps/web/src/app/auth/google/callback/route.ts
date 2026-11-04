import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decideGoogle, decodeIdToken, GOOGLE_ENABLED, GOOGLE_TOKEN_URL, validateClaims } from "@/features/account/google";
import { currentUser, openSession, setSessionCookie } from "@/features/account/session";
import { store, STORE_READONLY } from "@/lib/data/store";
import { OAUTH_COOKIE } from "../route";

export const GOOGLE_SIGNUP_COOKIE = "mayo_google_signup";

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** 구글에서 돌아온 곳. 쿠키의 state와 맞는지, 코드를 토큰으로 바꾸고 신원을 확인한 뒤 로그인, 연결, 가입으로 */
export async function GET(req: Request) {
  if (!GOOGLE_ENABLED) redirect("/login?google=off");
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/auth/google" });
  if (url.searchParams.get("error")) redirect("/login?google=cancel");
  let saved: { state: string; verifier: string; nonce: string; next: string; link: boolean };
  try {
    saved = JSON.parse(Buffer.from(raw ?? "", "base64url").toString("utf8"));
  } catch {
    redirect("/login?google=expired");
  }
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!saved?.state || !same(state, saved.state) || !code) redirect("/login?google=expired");
  if (STORE_READONLY) redirect("/login?google=readonly");

  // 코드 → 토큰 (서버끼리, TLS)
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: new URL("/auth/google/callback", url).toString(),
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const token = res?.ok ? ((await res.json()) as { id_token?: string }) : null;
  const claims = decodeIdToken(token?.id_token ?? "");
  if (!validateClaims(claims, { clientId: process.env.GOOGLE_CLIENT_ID!, nonce: saved.nonce })) redirect("/login?google=failed");

  const me = saved.link ? await currentUser() : null;
  if (saved.link && !me) redirect("/login?next=/account/settings");
  const email = claims.email.toLowerCase();
  const decision = decideGoogle(await store.read(), { sub: claims.sub, email }, me?.id ?? null);

  switch (decision.action) {
    case "login": {
      const t = await store.update((db) => openSession(db, decision.userId));
      await setSessionCookie(t);
      redirect(saved.next);
    }
    case "link": {
      await store.update((db) => {
        const u = db.users.find((x) => x.id === decision.userId);
        if (u && !db.users.some((x) => x.googleSub === claims.sub && x.id !== u.id)) u.googleSub = claims.sub;
      });
      redirect("/account/settings?google=linked");
    }
    case "taken":
      redirect("/account/settings?google=taken");
    case "use-password":
      redirect("/login?google=use-password");
    case "signup": {
      const pending = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(pending).digest("base64url");
      await store.update((db) => {
        db.oauthPending = (db.oauthPending ?? []).filter((p) => Date.parse(p.expiresAt) > Date.now() && p.sub !== claims.sub);
        db.oauthPending.push({ tokenHash, sub: claims.sub, email, name: (claims.name ?? "").slice(0, 40) || email.split("@")[0], picture: null, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
      });
      jar.set(GOOGLE_SIGNUP_COOKIE, pending, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 900 });
      redirect(`/signup/google?next=${encodeURIComponent(saved.next)}`);
    }
  }
}
