"use server";

import { z } from "zod";
import { READONLY_MESSAGE, store, STORE_READONLY } from "@/lib/data/store";
import { isRentable, rentalDeposit, rentalMonthly } from "@/lib/domain/rules";
import { CONSULT_KINDS, RENTAL_MONTHS } from "@/lib/domain/types";
import { newId, newTrackingCode } from "@/lib/ids";
import { allow, TOO_MANY } from "@/lib/security/rate-limit";
import { currentUser } from "@/features/account/session";
import { notifyReceived } from "@/features/mail/notify";

export type RentalFormState = { ok: false; errors: Record<string, string>; message?: string } | { ok: true; code: string } | null;

const phone = z.string().trim().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "전화번호를 확인해 주세요");
const bizNumber = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{3}-?\d{2}-?\d{5}$/.test(v), "사업자등록번호 10자리를 확인해 주세요");

const RentalInput = z.object({
  workIds: z.array(z.string().min(1)).min(1, "렌탈할 작품을 골라 주세요").max(30),
  audience: z.enum(["personal", "business"]),
  months: z.coerce.number().refine((m) => (RENTAL_MONTHS as readonly number[]).includes(m), "기간을 골라 주세요"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작 희망일을 골라 주세요"),
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(40),
  company: z.string().trim().max(60),
  bizNumber,
  email: z.string().trim().email("이메일을 확인해 주세요"),
  phone,
  address: z.string().trim().min(5, "작품을 둘 곳의 주소를 입력해 주세요").max(200),
  spaceNote: z.string().trim().max(1000),
  agreePrivacy: z.literal(true, { error: "개인정보 수집 및 이용에 동의해 주세요" }),
  agreeRental: z.literal(true, { error: "렌탈 조건을 확인해 주세요" }),
});

function errorsOf(issues: z.core.$ZodIssue[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

/** 렌탈 신청 (개인, 기업). 운영자가 작가와 일정을 맞춰 확정하면 그때 작품을 묶는다 */
export async function submitRental(_prev: RentalFormState, form: FormData): Promise<RentalFormState> {
  if (STORE_READONLY) return { ok: false, errors: {}, message: READONLY_MESSAGE };
  if (!(await allow("rental", 5, 10 * 60_000))) return { ok: false, errors: {}, message: TOO_MANY };
  const get = (k: string) => String(form.get(k) ?? "");
  const parsed = RentalInput.safeParse({
    workIds: form.getAll("workIds").map(String),
    audience: get("audience") || "personal",
    months: get("months"),
    startDate: get("startDate"),
    name: get("name"),
    company: get("company"),
    bizNumber: get("bizNumber"),
    email: get("email"),
    phone: get("phone"),
    address: get("address"),
    spaceNote: get("spaceNote"),
    agreePrivacy: form.get("agreePrivacy") === "on",
    agreeRental: form.get("agreeRental") === "on",
  });
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  const v = parsed.data;
  if (v.audience === "business" && !v.company) return { ok: false, errors: { company: "회사, 매장 이름을 입력해 주세요" } };

  const me = await currentUser();
  const code = newTrackingCode("R");
  const result = await store.update((db) => {
    const works = v.workIds.map((id) => db.works.find((w) => w.id === id));
    const bad = works.filter((w) => !w || !isRentable(w));
    if (bad.length > 0) return `지금 렌탈할 수 없는 작품이 있어요: ${bad.map((w) => (w ? `「${w.title}」` : "삭제된 작품")).join(", ")}`;
    const now = new Date().toISOString();
    db.rentals.push({
      id: newId("rent"),
      code,
      userId: me?.id ?? null,
      audience: v.audience,
      workIds: v.workIds,
      months: v.months,
      startDate: v.startDate,
      monthlyTotal: works.reduce((s, w) => s + rentalMonthly(w!.price), 0),
      deposit: works.reduce((s, w) => s + rentalDeposit(w!.price), 0),
      name: v.name,
      company: v.company || null,
      bizNumber: v.bizNumber || null,
      email: v.email,
      phone: v.phone,
      address: v.address,
      spaceNote: v.spaceNote,
      state: "requested",
      adminMemo: "",
      history: [{ at: now, state: "requested", note: "렌탈 신청" }],
      createdAt: now,
    });
    return null;
  });
  if (result) return { ok: false, errors: {}, message: result };
  notifyReceived(v.email, "렌탈 신청", code, "/admin/rentals", [`${v.company ? `${v.company} ` : ""}${v.name}, ${v.months}개월, 작품 ${v.workIds.length}점`]);
  return { ok: true, code };
}

const ConsultInput = z.object({
  kind: z.enum(CONSULT_KINDS),
  audience: z.enum(["personal", "business"]),
  company: z.string().trim().max(60),
  bizNumber,
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(40),
  email: z.string().trim().email("이메일을 확인해 주세요"),
  phone,
  space: z.string().trim().max(200),
  budget: z.string().trim().max(60),
  period: z.string().trim().max(60),
  mood: z.string().trim().max(300),
  workIds: z.array(z.string()).max(30),
  message: z.string().trim().max(2000),
  agreePrivacy: z.literal(true, { error: "개인정보 수집 및 이용에 동의해 주세요" }),
});

/** 기업전용관 상담, 작품 추천 받기 */
export async function submitConsultation(_prev: RentalFormState, form: FormData): Promise<RentalFormState> {
  if (STORE_READONLY) return { ok: false, errors: {}, message: READONLY_MESSAGE };
  if (!(await allow("consult", 5, 10 * 60_000))) return { ok: false, errors: {}, message: TOO_MANY };
  const get = (k: string) => String(form.get(k) ?? "");
  const parsed = ConsultInput.safeParse({
    kind: get("kind"),
    audience: get("audience") || "business",
    company: get("company"),
    bizNumber: get("bizNumber"),
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    space: get("space"),
    budget: get("budget"),
    period: get("period"),
    mood: get("mood"),
    workIds: form.getAll("workIds").map(String),
    message: get("message"),
    agreePrivacy: form.get("agreePrivacy") === "on",
  });
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  const v = parsed.data;
  if (v.audience === "business" && !v.company) return { ok: false, errors: { company: "회사, 매장 이름을 입력해 주세요" } };
  if (!v.message && !v.mood && !v.space) return { ok: false, errors: { message: "원하는 내용을 조금만 적어 주세요" } };
  const me = await currentUser();
  const code = newTrackingCode("B");
  await store.update((db) => {
    db.consultations.push({
      id: newId("con"),
      code,
      userId: me?.id ?? null,
      audience: v.audience,
      kind: v.kind,
      company: v.company || null,
      bizNumber: v.bizNumber || null,
      name: v.name,
      email: v.email,
      phone: v.phone,
      space: v.space,
      budget: v.budget,
      period: v.period,
      mood: v.mood,
      workIds: v.workIds.filter((id) => db.works.some((w) => w.id === id)),
      message: v.message,
      state: "new",
      answer: null,
      createdAt: new Date().toISOString(),
    });
  });
  notifyReceived(v.email, v.audience === "business" ? "기업 상담 신청" : "작품 추천 신청", code, "/admin/consultations", [`${v.company ? `${v.company} ` : ""}${v.name}, ${v.kind}`]);
  return { ok: true, code };
}
