"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Celebrate } from "@/components/ui/celebrate";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { INQUIRY_TOPIC_LABEL } from "@/lib/domain/rules";
import { submitInquiry, type InquiryFormState } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState<InquiryFormState, FormData>(submitInquiry, null);
  const errors = state && !state.ok ? state.errors : {};

  if (state?.ok)
    return (
      <Celebrate eyebrow="문의 접수 완료" title="문의를 잘 받았어요" code={state.code} codeTitle={state.title}>
        보통 하루 안에 답변드려요. 답변은 ‘내 신청 현황’과 이메일로 확인할 수 있어요.
      </Celebrate>
    );

  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="문의 종류" required>
        <Select name="topic" defaultValue="purchase">
          {Object.entries(INQUIRY_TOPIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="관련 번호" hint="주문이나 신청 번호가 있으면 적어 주세요"><Input name="relatedCode" placeholder="MAYO-… / J-… / E-…" /></Field>
      <Field label="이름" required error={errors.name}><Input name="name" autoComplete="name" /></Field>
      <Field label="이메일" required error={errors.email}><Input name="email" type="email" autoComplete="email" /></Field>
      <Field label="휴대폰" hint="전화로 받고 싶을 때만"><Input name="phone" inputMode="tel" /></Field>
      <Field label="제목" required error={errors.subject}><Input name="subject" /></Field>
      <Field label="내용" required error={errors.message} className="sm:col-span-2"><Textarea name="message" className="min-h-40" /></Field>
      <div className="sm:col-span-2">
        <Checkbox name="agreePrivacy" label={<>답변을 위한 <Link href="/legal/privacy" target="_blank" className="underline">개인정보 수집 및 이용</Link>에 동의해요 (필수)</>} />
        {errors.agreePrivacy && <p className="mt-1 text-xs font-medium text-dot">{errors.agreePrivacy}</p>}
      </div>
      {errors.form && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot sm:col-span-2">{errors.form}</p>}
      <Button type="submit" size="lg" disabled={pending} className="sm:col-span-2">{pending ? "보내는 중…" : "문의 보내기"}</Button>
    </ActionForm>
  );
}
