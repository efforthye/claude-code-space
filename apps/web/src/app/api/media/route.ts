import { currentUser } from "@/features/account/session";
import { STORE_READONLY } from "@/lib/data/store";
import { saveImage, UploadError } from "@/lib/data/uploads";
import { hit, clientIp } from "@/lib/security/rate-limit";
import { MAX_BYTES } from "@/lib/security/media-sniff";

/**
 * 회원 사진 업로드 (프로필 사진, 배경, 작업실 사진): multipart `file` → { kind, src }.
 * 로그인 필수, 같은 사이트에서만, 사진만 10MB, 회원과 IP마다 10분에 20장.
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });
  if (STORE_READONLY) return Response.json({ error: "저장소 연결 전이라 업로드할 수 없어요" }, { status: 503 });
  const ip = await clientIp();
  if (!hit(`member-media:${me.id}`, 20, 10 * 60_000) || !hit(`member-media-ip:${ip}`, 40, 10 * 60_000)) {
    return Response.json({ error: "잠시 후 다시 올려 주세요" }, { status: 429 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES.image + 512 * 1024) return Response.json({ error: "사진은 10MB 이하로 올려 주세요" }, { status: 413 });
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "파일이 없어요" }, { status: 400 });
  try {
    return Response.json({ kind: "image", src: await saveImage(file) }, { status: 201 });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 415 });
    throw e;
  }
}
