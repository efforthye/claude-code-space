"use server";

import { z } from "zod";
import { store } from "@/lib/data/store";
import { newId } from "@/lib/ids";

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
    venue: z.string().trim().min(1, "장소를 입력해 주세요").max(100),
    artistCount: z.string().trim(),
    support: z.array(z.enum(["archive", "photo", "qr"])),
    message: z.string().trim().max(1000),
    agreePrivacy: z.literal(true, { error: "개인정보 수집·이용에 동의해 주세요" }),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "종료일이 시작일보다 빨라요", path: ["endDate"] });

export type RequestFormState = { ok: false; errors: Record<string, string> } | { ok: true } | null;

export async function submitExhibitionRequest(_prev: RequestFormState, form: FormData): Promise<RequestFormState> {
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
    venue: get("venue"),
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
  await store.update((db) => {
    db.exhibitionRequests.push({
      id: newId("exr"),
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
      venue: v.venue,
      artistCount: /^\d+$/.test(v.artistCount) ? Number(v.artistCount) : null,
      support: v.support,
      message: v.message,
      state: "new",
      exhibitionId: null,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok: true };
}
