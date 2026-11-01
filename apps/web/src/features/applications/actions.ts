"use server";

import { z } from "zod";
import { store } from "@/lib/data/store";
import { isMinor, isUnder14 } from "@/lib/domain/rules";
import { newId } from "@/lib/ids";

const httpsUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https:\/\//.test(v), "https:// 로 시작하는 주소만 받아요");

const ApplicationInput = z.object({
  name: z.string().trim().min(1, "이름(작가명)을 입력해 주세요").max(40),
  email: z.string().trim().email("이메일을 확인해 주세요"),
  phone: z.string().trim().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "휴대폰 번호를 확인해 주세요"),
  status: z.enum(["student", "graduate", "aspiring", "general"]),
  schoolName: z.string().trim().max(60),
  department: z.string().trim().max(60),
  gradYear: z.string().trim(),
  birthYear: z.coerce.number().int().min(1900, "출생연도를 확인해 주세요").max(2030),
  guardianName: z.string().trim().max(40),
  guardianPhone: z.string().trim().max(20),
  guardianConsent: z.boolean(),
  instagram: z.string().trim().max(60),
  portfolioUrl: httpsUrl,
  message: z.string().trim().max(1000),
  agreePrivacy: z.literal(true, { error: "개인정보 수집·이용에 동의해 주세요" }),
  agreeImage: z.literal(true, { error: "작품 이미지 이용 허락에 동의해 주세요" }),
});

export type ApplicationFormState = { ok: false; errors: Record<string, string> } | { ok: true } | null;

export async function submitApplication(_prev: ApplicationFormState, form: FormData): Promise<ApplicationFormState> {
  const get = (k: string) => String(form.get(k) ?? "");
  const parsed = ApplicationInput.safeParse({
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    status: get("status"),
    schoolName: get("schoolName"),
    department: get("department"),
    gradYear: get("gradYear"),
    birthYear: get("birthYear"),
    guardianName: get("guardianName"),
    guardianPhone: get("guardianPhone"),
    guardianConsent: form.get("guardianConsent") === "on",
    instagram: get("instagram").replace(/^@/, ""),
    portfolioUrl: get("portfolioUrl"),
    message: get("message"),
    agreePrivacy: form.get("agreePrivacy") === "on",
    agreeImage: form.get("agreeImage") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const v = parsed.data;

  // 만 14세 미만은 법정대리인 동의 확인 절차가 필요해 받지 않는다 (가이드 15장 ③).
  if (isUnder14(v.birthYear)) return { ok: false, errors: { birthYear: "만 14세 미만은 입점 신청을 받지 않아요" } };
  const minor = isMinor(v.birthYear);
  if (minor && (!v.guardianName || !v.guardianPhone || !v.guardianConsent)) {
    return { ok: false, errors: { guardianName: "만 19세 미만은 보호자 정보와 동의가 필요해요" } };
  }
  if ((v.status === "student" || v.status === "graduate") && !v.schoolName) {
    return { ok: false, errors: { schoolName: "학교 이름을 입력해 주세요" } };
  }

  await store.update((db) => {
    db.applications.push({
      id: newId("app"),
      name: v.name,
      email: v.email,
      phone: v.phone,
      status: v.status,
      schoolName: v.schoolName,
      department: v.department,
      gradYear: /^\d{4}$/.test(v.gradYear) ? Number(v.gradYear) : null,
      birthYear: v.birthYear,
      guardian: minor ? { name: v.guardianName, phone: v.guardianPhone } : null,
      instagram: v.instagram || null,
      portfolioUrl: v.portfolioUrl || null,
      message: v.message,
      state: "new",
      artistId: null,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok: true };
}
