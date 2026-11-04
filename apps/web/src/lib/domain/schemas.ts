import { z } from "zod";
import { MEDIA_KINDS, WORK_KINDS } from "./types";

/** 사이트가 올린 파일(/media, /samples) 또는 https 주소만 */
export const MediaSrc = z
  .string()
  .max(500)
  .refine((v) => /^\/(media|samples)\/[\w./-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v), "허용되지 않는 미디어 주소");

export const MediaList = z
  .array(z.object({ kind: z.enum(MEDIA_KINDS), src: MediaSrc, poster: MediaSrc.nullish(), alt: z.string().max(200).nullish() }))
  .max(30);

export const StoryList = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(3000) }),
      z.object({ kind: z.literal("image"), src: MediaSrc, caption: z.string().trim().max(200).nullable() }),
    ]),
  )
  .max(40);

/** 작가가 마이페이지에서 올리는 작품 (가격, 크기, 재료 등). 상태와 운영 표시는 관리자 몫이라 받지 않는다. */
export const ArtistWorkInput = z.object({
  title: z.string().trim().min(1, "작품명을 입력해 주세요").max(80),
  medium: z.string().trim().min(1, "분류를 골라 주세요"),
  kind: z.enum(WORK_KINDS),
  materials: z.string().trim().min(1, "재료를 입력해 주세요").max(120),
  widthCm: z.number().positive("가로 크기를 입력해 주세요").max(2000),
  heightCm: z.number().positive("세로 크기를 입력해 주세요").max(2000),
  depthCm: z.number().positive().max(2000).nullable(),
  weightKg: z.number().positive().max(5000).nullable(),
  year: z.number().int().min(1900, "제작 연도를 확인해 주세요").max(2100),
  edition: z.string().trim().max(20).nullable(),
  price: z.number().int().min(1000, "가격은 1,000원 이상으로 정해 주세요").max(1_000_000_000),
  description: z.string().trim().max(3000),
  allowsPickup: z.boolean(),
});

/** JSON 문자열 필드를 스키마로 읽는다 (실패하면 null) */
export function parseJson<T extends z.ZodType>(schema: T, raw: string): z.infer<T> | null {
  try {
    const r = schema.safeParse(JSON.parse(raw || "[]"));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
