import type { MediaKind } from "@/lib/domain/types";

export type SniffedMedia = { kind: MediaKind; ext: "jpg" | "png" | "webp" | "avif" | "mp4" | "webm" | "glb"; type: string };

/**
 * 업로드 파일의 실제 바이트로 형식을 판별한다 (브라우저가 보낸 Content-Type·확장자는 믿지 않는다).
 * 허용: JPG·PNG·WEBP·AVIF 사진, MP4·WebM 영상, GLB(바이너리 glTF) 3D.
 */
export function sniffMedia(bytes: Uint8Array): SniffedMedia | null {
  const b = bytes;
  const ascii = (from: number, to: number) => (b.length >= to ? String.fromCharCode(...b.slice(from, to)) : "");
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", ext: "jpg", type: "image/jpeg" };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { kind: "image", ext: "png", type: "image/png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", ext: "webp", type: "image/webp" };
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (/^avi[fs]$/.test(brand)) return { kind: "image", ext: "avif", type: "image/avif" };
    // ISO base media 영상 브랜드 (mp4, m4v, quicktime 호환)
    if (/^(isom|iso[2-9]|mp4[12]|M4V |M4VP|avc1|dash|qt  |mmp4|MSNV)$/.test(brand)) return { kind: "video", ext: "mp4", type: "video/mp4" };
    return null;
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", ext: "webm", type: "video/webm" };
  if (ascii(0, 4) === "glTF") return { kind: "model", ext: "glb", type: "model/gltf-binary" };
  return null;
}

/** 이미지만 받는 곳(작품 사진 외 용도)에서 쓰는 축약형 */
export function sniffImage(bytes: Uint8Array) {
  const m = sniffMedia(bytes);
  return m?.kind === "image" ? m.ext : null;
}

export const MAX_BYTES: Record<MediaKind, number> = {
  image: 10 * 1024 * 1024,
  video: 80 * 1024 * 1024,
  model: 30 * 1024 * 1024,
};

export const EXT_TYPE: Record<SniffedMedia["ext"], string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  glb: "model/gltf-binary",
};
