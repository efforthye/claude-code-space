"use server";

import { z } from "zod";
import { READONLY_MESSAGE, store, STORE_READONLY } from "@/lib/data/store";
import { allow, TOO_MANY } from "@/lib/security/rate-limit";
import { readPlace } from "@/features/places/parse";
import { newId, newTrackingCode } from "@/lib/ids";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요");

const RequestInput = z
  .object({
    organizer: z.enum(["committee", "council", "department", "artist", "other"]),
    contactName: z.string().trim().min(1, "담당자 이름을 입력해 주세요").max(40),
    email: z.string().trim().email("이메일을 확인해 주세요"),
    phone: z.string().trim().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "휴대폰 번호를 확인해 주세요"),
    schoolName: z.string().trim().min(1, "학교 이름을 입력해 주세요").max(60),
    department: z.string().trim().max(60),
    title: z.string().trim().min(1, "전시명을 입력해 주세요").max(100),
    kind: z.enum(["graduation", "coursework", "other"]),
    startDate: date,
    endDate: date,
    artistCount: z.string().trim(),
    support: z.array(z.enum(["archive", "photo", "qr"])),
    message: z.string().trim().max(1000),
    agreePrivacy: z.literal(true, { error: "개인정보 수집 및 이용에 동의해 주세요" }),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "종료일이 시작일보다 빨라요", path: ["endDate"] });

export type RequestFormState = { ok: false; errors: Record<string, string> } | { ok: true; code: string; title: string } | null;

export async function submitExhibitionRequest(_prev: RequestFormState, form: FormData): Promise<RequestFormState> {
  if (STORE_READONLY) return { ok: false, errors: { form: READONLY_MESSAGE } };
  if (!(await allow("exhibition-request", 5, 10 * 60_000))) return { ok: false, errors: { form: TOO_MANY } };
  const get = (k: string) => String(form.get(k) ?? "");
  const parsed = RequestInput.safeParse({
    organizer: get("organizer"),
    contactName: get("contactName"),
    email: get("email"),
    phone: get("phone"),
    schoolName: get("schoolName"),
    department: get("department"),
    title: get("title"),
    kind: get("kind"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    artistCount: get("artistCount"),
    support: form.getAll("support").map(String),
    message: get("message"),
    agreePrivacy: form.get("agreePrivacy") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const v = parsed.data;
  const { place, venue } = readPlace(form, "venue");
  if (!venue) return { ok: false, errors: { venue: "장소를 검색해서 골라 주세요" } };
  const code = newTrackingCode("E");
  await store.update((db) => {
    db.exhibitionRequests.push({
      id: newId("exr"),
      code,
      organizer: v.organizer,
      contactName: v.contactName,
      email: v.email,
      phone: v.phone,
      schoolName: v.schoolName,
      department: v.department,
      title: v.title,
      kind: v.kind,
      startDate: v.startDate,
      endDate: v.endDate,
      venue,
      place,
      artistCount: /^\d+$/.test(v.artistCount) ? Number(v.artistCount) : null,
      support: v.support,
      message: v.message,
      state: "new",
      exhibitionId: null,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok: true, code, title: `전시 등록 신청: ${v.title}` };
}
