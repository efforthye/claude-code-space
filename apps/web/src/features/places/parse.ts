import { z } from "zod";
import type { Place } from "@/lib/domain/types";

const PlaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(200).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  url: z.string().regex(/^https?:\/\//).max(300).nullable(),
});

/** PlacePicker가 보낸 필드를 검증해 { place, venue } 로 돌려준다. 고르지 않았으면 place = null. */
export function readPlace(form: FormData, name: string): { place: Place | null; venue: string } {
  let place: Place | null = null;
  try {
    const parsed = PlaceSchema.safeParse(JSON.parse(String(form.get(`${name}Place`) || "null")));
    if (parsed.success) place = { ...parsed.data, url: parsed.data.url?.replace(/^http:/, "https:") ?? null };
  } catch {
    place = null;
  }
  const detail = String(form.get(`${name}Detail`) ?? "").trim().slice(0, 100);
  const venue = [place?.name ?? String(form.get(name) ?? "").trim(), detail].filter(Boolean).join(" ");
  return { place, venue };
}
