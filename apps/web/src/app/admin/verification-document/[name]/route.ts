import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSession } from "@/features/admin/session";
import { store } from "@/lib/data/store";
import { readPrivate } from "@/lib/data/uploads";

/** 학교 인증 서류 보기: 관리자만, 아직 결정 전인 요청의 서류만. 캐시하지 않는다. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/verification-document/[name]">) {
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value)) return new Response("Unauthorized", { status: 401 });
  const { name } = await ctx.params;
  const db = await store.read();
  if (!db.verifications.some((v) => v.document === name && v.state === "new")) return new Response("Not found", { status: 404 });
  return readPrivate(name);
}
