import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { currentUser } from "@/features/account/session";
import { ADMIN_COOKIE, isValidSession } from "@/features/admin/session";
import { BLOB_ENABLED } from "@/lib/data/uploads";
import { MAX_BYTES } from "@/lib/security/media-sniff";
import { count } from "@/lib/security/rate-limit";

const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ADMIN_TYPES = [...IMAGES, "video/mp4", "video/webm", "model/gltf-binary"];

/** 브라우저가 Blob으로 직접 올릴 수 있는지 (서버 요청 크기 제한 4.5MB를 피하려고 직접 올린다) */
export async function GET() {
  return Response.json({ enabled: BLOB_ENABLED });
}

/**
 * 직접 업로드 허가증 발급. 서버는 파일을 받지 않고, 누가 무엇을 얼마나 올릴지만 정한다.
 * - 관리자: 사진, 영상(MP4, WebM), 3D(GLB), 80MB까지
 * - 회원: 사진만 10MB까지
 * - 같은 사이트에서만, 시간당 횟수 제한, 경로는 media/ 아래로만
 */
export async function POST(req: Request) {
  if (!BLOB_ENABLED) return Response.json({ error: "파일 저장소가 연결되지 않았어요" }, { status: 501 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const admin = isValidSession((await cookies()).get(ADMIN_COOKIE)?.value);
        const me = admin ? null : await currentUser();
        if (!admin && !me) throw new Error("로그인이 필요해요");
        if (!/^media\/[\w-]+\.(jpg|jpeg|png|webp|avif|mp4|webm|glb)$/i.test(pathname)) throw new Error("허용되지 않는 파일 이름이에요");
        const who = admin ? "admin" : `member:${me!.id}`;
        if (!(await count(`blob-upload:${who}`, admin ? 200 : 30, 60 * 60_000))) throw new Error("잠시 후 다시 올려 주세요");
        return {
          allowedContentTypes: admin ? ADMIN_TYPES : IMAGES,
          maximumSizeInBytes: admin ? MAX_BYTES.video : MAX_BYTES.image,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ who }),
        };
      },
      onUploadCompleted: async () => {
        // 작품, 프로필에 붙이는 건 저장 버튼을 누를 때 (서버에서 주소를 다시 검증한다)
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
