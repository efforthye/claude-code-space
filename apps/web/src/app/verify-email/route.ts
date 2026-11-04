import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { store, STORE_READONLY } from "@/lib/data/store";
import { allow } from "@/lib/security/rate-limit";

/** 학교 이메일 확인 링크. 토큰이 맞고 기한 안이면 확인 시각을 남긴다 (승인은 운영자가). 한 번만 쓰인다. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (STORE_READONLY || !(await allow("verify-email", 30, 60 * 60_000)) || token.length < 20 || token.length > 100) redirect("/account/verify?email=invalid");
  const hash = createHash("sha256").update(token).digest("base64url");
  const ok = await store.update((db) => {
    const v = db.verifications.find((x) => x.emailTokenHash === hash && x.state === "new");
    if (!v || !v.emailTokenExpiresAt || Date.parse(v.emailTokenExpiresAt) < Date.now()) return false;
    v.emailConfirmedAt = new Date().toISOString();
    v.emailTokenHash = null;
    return true;
  });
  redirect(ok ? "/account/verify?email=confirmed" : "/account/verify?email=invalid");
}
