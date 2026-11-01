import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { sniffImage } from "@/lib/security/image-sniff";
import { DATA_DIR } from "./store";

/**
 * 이미지 저장 seam. 개발에서는 `.data/uploads`에 두고 /media/<name>으로 서빙한다.
 * 실서비스는 Vercel 파일시스템이 읽기 전용이라 오브젝트 스토리지(예: Vercel Blob,
 * 또는 mayo-api 미디어)로 바꿔야 한다 — 이 파일만 고치면 된다.
 */
const DIR = path.join(DATA_DIR, "uploads");
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("이미지는 10MB 이하로 올려 주세요");
  const data = new Uint8Array(await file.arrayBuffer());
  // 확장자·Content-Type이 아니라 실제 바이트로 판별 — 이미지로 위장한 HTML/SVG를 막는다
  const ext = sniffImage(data);
  if (!ext) throw new Error("JPG·PNG·WEBP·AVIF 이미지만 올릴 수 있어요");
  await fs.mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(DIR, name), data, { flag: "wx" });
  return `/media/${name}`;
}

export async function readImage(name: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(name)) return null;
  try {
    const data = await fs.readFile(path.join(DIR, name));
    const type = Object.entries(TYPES).find(([, e]) => name.endsWith(`.${e}`))![0];
    return { data, type };
  } catch {
    return null;
  }
}
