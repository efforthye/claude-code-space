import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { MediaItem } from "@/lib/domain/types";
import { EXT_TYPE, MAX_BYTES, sniffMedia, type SniffedMedia } from "@/lib/security/media-sniff";
import { DATA_DIR } from "./store";

/**
 * 미디어 저장 seam. 개발에서는 `.data/uploads`에 두고 /media/<name>으로 서빙한다.
 * 실서비스는 Vercel 파일시스템이 읽기 전용이라 오브젝트 스토리지(Vercel Blob, R2 등)로 바꿔야 한다
 *, 이 파일만 고치면 된다.
 */
const DIR = path.join(DATA_DIR, "uploads");
const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4|webm|glb)$/;

export class UploadError extends Error {}

/** Vercel은 디스크가 읽기 전용이라, 파일 저장소(Vercel Blob 등)를 붙이기 전까지 업로드를 받지 않는다 */
const UPLOADS_OFF = Boolean(process.env.VERCEL);
const UPLOADS_OFF_MESSAGE = "사진 저장소를 준비하고 있어요. 사진은 문의하기로 보내 주시면 운영자가 올려 드려요.";

/** 바이트로 형식을 판별하고 종류별 용량 상한을 지킨 뒤 저장한다. 같은 이름 덮어쓰기 금지(wx). */
export async function saveMedia(file: File): Promise<MediaItem> {
  if (UPLOADS_OFF) throw new UploadError(UPLOADS_OFF_MESSAGE);
  // 가장 큰 상한보다 크면 읽기 전에 거절 (메모리 보호)
  if (file.size > MAX_BYTES.video) throw new UploadError("파일이 너무 커요 (영상 80MB, 3D 30MB, 사진 10MB까지)");
  const data = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(data);
  if (!sniffed) throw new UploadError("사진(JPG, PNG, WEBP, AVIF), 영상(MP4, WebM), 3D(GLB)만 올릴 수 있어요");
  if (data.byteLength > MAX_BYTES[sniffed.kind]) {
    throw new UploadError(sniffed.kind === "image" ? "사진은 10MB 이하로 올려 주세요" : sniffed.kind === "model" ? "3D 파일은 30MB 이하로 올려 주세요" : "영상은 80MB 이하로 올려 주세요");
  }
  await fs.mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.${sniffed.ext}`;
  await fs.writeFile(path.join(DIR, name), data, { flag: "wx" });
  return { kind: sniffed.kind, src: `/media/${name}` };
}

/** 예전 호출부 호환: 사진만 받는 곳 */
export async function saveImage(file: File): Promise<string> {
  const item = await saveMedia(file);
  if (item.kind !== "image") throw new UploadError("JPG, PNG, WEBP, AVIF 이미지만 올릴 수 있어요");
  return item.src;
}

export const MAX_UPLOAD_BYTES = MAX_BYTES.image;

/**
 * 비공개 사진 (학교 인증 서류). /media로 서빙하지 않는 별도 폴더에 두고,
 * 관리자 전용 라우트로만 읽는다. 결정이 나면 deletePrivate로 바로 지운다.
 */
const PRIVATE_DIR = path.join(DATA_DIR, "private");

export async function savePrivateImage(file: File): Promise<string> {
  if (UPLOADS_OFF) throw new UploadError(UPLOADS_OFF_MESSAGE);
  if (file.size > MAX_BYTES.image) throw new UploadError("사진은 10MB 이하로 올려 주세요");
  const data = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(data);
  if (!sniffed || sniffed.kind !== "image") throw new UploadError("JPG, PNG, WEBP, AVIF 사진만 올릴 수 있어요");
  await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}.${sniffed.ext}`;
  await fs.writeFile(path.join(PRIVATE_DIR, name), data, { flag: "wx", mode: 0o600 });
  return name;
}

export async function readPrivate(name: string): Promise<Response> {
  if (!NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(PRIVATE_DIR, name));
    const ext = name.split(".").pop() as SniffedMedia["ext"];
    return new Response(data, {
      headers: {
        "Content-Type": EXT_TYPE[ext],
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function deletePrivate(name: string | null) {
  if (!name || !NAME.test(name)) return;
  await fs.rm(path.join(PRIVATE_DIR, name), { force: true });
}

/** /media 응답: 영상 탐색(iOS Safari 필수)을 위해 Range 요청을 지원한다. */
export async function serveMedia(name: string, rangeHeader: string | null): Promise<Response> {
  if (!NAME.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(DIR, name);
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const ext = name.split(".").pop() as SniffedMedia["ext"];
  const base = {
    "Content-Type": EXT_TYPE[ext],
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };

  const m = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...base, "Content-Length": String(size) } });
}
