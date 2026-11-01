"use server";

import { z } from "zod";
import { store } from "@/lib/data/store";
import { INQUIRY_TOPICS } from "@/lib/domain/types";
import { newId, newTrackingCode } from "@/lib/ids";

const InquiryInput = z.object({
  topic: z.enum(INQUIRY_TOPICS),
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(40),
  email: z.string().trim().email("답변 받을 이메일을 확인해 주세요"),
  phone: z.string().trim().max(20),
  subject: z.string().trim().min(2, "제목을 입력해 주세요").max(80),
  message: z.string().trim().min(5, "문의 내용을 조금 더 적어 주세요").max(3000),
  relatedCode: z.string().trim().max(20),
  agreePrivacy: z.literal(true, { error: "개인정보 수집·이용에 동의해 주세요" }),
});

export type InquiryFormState = { ok: false; errors: Record<string, string> } | { ok: true; code: string; title: string } | null;

export async function submitInquiry(_prev: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  const get = (k: string) => String(form.get(k) ?? "");
  const parsed = InquiryInput.safeParse({
    topic: get("topic"),
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    subject: get("subject"),
    message: get("message"),
    relatedCode: get("relatedCode"),
    agreePrivacy: form.get("agreePrivacy") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const v = parsed.data;
  const code = newTrackingCode("Q");
  await store.update((db) => {
    db.inquiries.push({
      id: newId("inq"),
      code,
      topic: v.topic,
      name: v.name,
      email: v.email,
      phone: v.phone || null,
      subject: v.subject,
      message: v.message,
      relatedCode: v.relatedCode.toUpperCase() || null,
      state: "new",
      answer: null,
      answeredAt: null,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok: true, code, title: `문의 · ${v.subject}` };
}
