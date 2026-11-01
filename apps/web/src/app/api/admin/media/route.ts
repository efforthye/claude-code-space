import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSession } from "@/features/admin/session";
import { STORE_READONLY } from "@/lib/data/store";
import { saveMedia, UploadError } from "@/lib/data/uploads";
import { allow } from "@/lib/security/rate-limit";
import { MAX_BYTES } from "@/lib/security/media-sniff";

/**
 * 관리자 미디어 업로드: multipart `file` 한 개 → { kind, src }.
 * - 관리자 세션 필수(서명 검증), 같은 사이트에서만(SameSite=Strict 쿠키 + Origin 확인)
 * - 분당 60회 제한, Content-Length로 먼저 거르고 저장 시 바이트로 형식, 용량 재확인
 */
export async function POST(req: Request) {
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (STORE_READONLY) return Response.json({ error: "저장소 연결 전이라 업로드할 수 없어요" }, { status: 503 });
  if (!(await allow("admin-media", 60, 60_000))) return Response.json({ error: "rate_limited" }, { status: 429 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES.video + 1024 * 1024) return Response.json({ error: "파일이 너무 커요" }, { status: 413 });

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "파일이 없어요" }, { status: 400 });

  try {
    return Response.json(await saveMedia(file), { status: 201 });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 415 });
    throw e;
  }
}
