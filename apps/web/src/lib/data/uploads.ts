import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { MediaItem } from "@/lib/domain/types";
import { EXT_TYPE, MAX_BYTES, sniffMedia, type SniffedMedia } from "@/lib/security/media-sniff";
import { put } from "@vercel/blob";
import { Binary } from "mongodb";
import { ensureIndex, mongoDb, USE_MONGO } from "./mongo";
import { DATA_DIR } from "./store";

/**
 * 미디어 저장 seam. 개발에서는 `.data/uploads`에 두고 /media/<name>으로 서빙한다.
 * 실서비스는 Vercel 파일시스템이 읽기 전용이라 오브젝트 스토리지(Vercel Blob, R2 등)로 바꿔야 한다
 *, 이 파일만 고치면 된다.
 */
const DIR = path.join(DATA_DIR, "uploads");
const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4|webm|glb)$/;

export class UploadError extends Error {}

/**
 * 어디에 저장하나:
 * - 공개 파일(작품 사진, 영상, 3D, 포스터, 프로필): Vercel Blob (BLOB_READ_WRITE_TOKEN), 없으면 로컬 디스크
 * - 비공개 서류(학생증): MongoDB, 없으면 로컬 디스크. Blob은 주소만 알면 누구나 열 수 있어서 쓰지 않는다
 * Vercel은 디스크가 읽기 전용이라 해당 저장소가 없으면 업로드를 받지 않는다.
 */
export const BLOB_ENABLED = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const ON_VERCEL = Boolean(process.env.VERCEL);
const UPLOADS_OFF = ON_VERCEL && !BLOB_ENABLED;
const PRIVATE_OFF = ON_VERCEL && !USE_MONGO;
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
  const name = `${randomUUID()}.${sniffed.ext}`;
  if (BLOB_ENABLED) {
    const blob = await put(`media/${name}`, Buffer.from(data), { access: "public", contentType: EXT_TYPE[sniffed.ext], addRandomSuffix: false });
    return { kind: sniffed.kind, src: blob.url };
  }
  await fs.mkdir(DIR, { recursive: true });
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

type PrivateFile = { _id: string; type: string; data: Binary; createdAt: Date };

/** 비공개 서류 컬렉션. 결정과 함께 지우지만, 혹시 남아도 30일 뒤 자동 삭제 */
async function privateFiles() {
  await ensureIndex("private_files", { createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600, name: "expire_30d" });
  return (await mongoDb()).collection<PrivateFile>("private_files");
}

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
};

export async function savePrivateImage(file: File): Promise<string> {
  if (PRIVATE_OFF) throw new UploadError(UPLOADS_OFF_MESSAGE);
  if (file.size > MAX_BYTES.image) throw new UploadError("사진은 10MB 이하로 올려 주세요");
  const data = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(data);
  if (!sniffed || sniffed.kind !== "image") throw new UploadError("JPG, PNG, WEBP, AVIF 사진만 올릴 수 있어요");
  const name = `${randomUUID()}.${sniffed.ext}`;
  if (USE_MONGO) {
    await (await privateFiles()).insertOne({ _id: name, type: EXT_TYPE[sniffed.ext], data: new Binary(data), createdAt: new Date() });
    return name;
  }
  await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(PRIVATE_DIR, name), data, { flag: "wx", mode: 0o600 });
  return name;
}

export async function readPrivate(name: string): Promise<Response> {
  if (!NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    if (USE_MONGO) {
      const doc = await (await privateFiles()).findOne({ _id: name });
      if (!doc) return new Response("Not found", { status: 404 });
      return new Response(new Uint8Array(doc.data.buffer), { headers: { "Content-Type": doc.type, ...PRIVATE_HEADERS } });
    }
    const data = await fs.readFile(path.join(PRIVATE_DIR, name));
    const ext = name.split(".").pop() as SniffedMedia["ext"];
    return new Response(data, { headers: { "Content-Type": EXT_TYPE[ext], ...PRIVATE_HEADERS } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function deletePrivate(name: string | null) {
  if (!name || !NAME.test(name)) return;
  if (USE_MONGO) {
    await (await privateFiles()).deleteOne({ _id: name });
    return;
  }
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
