"use client";

import { ActionForm } from "@/components/ui/action-form";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Celebrate } from "@/components/ui/celebrate";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EXHIBITION_KIND_LABEL, ORGANIZER_LABEL, SUPPORT_LABEL } from "@/lib/domain/rules";
import { PlacePicker } from "@/features/places/place-picker";
import { submitExhibitionRequest, type RequestFormState } from "./actions";

export function ExhibitionRequestForm() {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(submitExhibitionRequest, null);
  const errors = state && !state.ok ? state.errors : {};

  if (state?.ok)
    return (
      <Celebrate
        eyebrow="전시 등록 신청 완료"
        title="졸업 전시, 온라인에서도 오래 걸어 둘게요"
        code={state.code}
        codeTitle={state.title}
        actions={<Link href="/exhibitions" className="inline-flex h-10 items-center rounded-sm border border-ink px-4 text-sm font-semibold transition hover:bg-ink hover:text-paper">전시 목록으로</Link>}
      >
        확인 후 담당자 연락처로 전시 페이지 오픈 일정과 촬영, QR 라벨 준비를 안내드릴게요.
      </Celebrate>
    );

  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="신청하는 곳" required>
        <Select name="organizer" defaultValue="committee">
          {Object.entries(ORGANIZER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="담당자 이름" required error={errors.contactName}><Input name="contactName" /></Field>
      <Field label="이메일" required error={errors.email}><Input name="email" type="email" /></Field>
      <Field label="휴대폰" required error={errors.phone}><Input name="phone" inputMode="tel" placeholder="010-0000-0000" /></Field>
      <Field label="학교" required error={errors.schoolName}><Input name="schoolName" placeholder="홍익대학교" /></Field>
      <Field label="학과, 단과대"><Input name="department" placeholder="미술대학 회화과" /></Field>
      <Field label="전시명" required error={errors.title} className="sm:col-span-2"><Input name="title" placeholder="2026 ○○과 졸업전시 〈제목〉" /></Field>
      <Field label="전시 구분" required>
        <Select name="kind" defaultValue="graduation">
          {Object.entries(EXHIBITION_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="참여 작가 수"><Input name="artistCount" inputMode="numeric" placeholder="25" /></Field>
      <Field label="시작일" required error={errors.startDate}><Input name="startDate" type="date" /></Field>
      <Field label="종료일" required error={errors.endDate}><Input name="endDate" type="date" /></Field>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-semibold">장소<span className="ml-0.5 text-dot">*</span></span>
        <PlacePicker name="venue" error={errors.venue} />
        {errors.venue && <span className="text-xs font-medium text-dot">{errors.venue}</span>}
      </div>

      <fieldset className="flex flex-col gap-2 rounded-md border border-line bg-paper p-4 sm:col-span-2">
        <legend className="px-1 text-sm font-semibold">원하는 지원 (이번 시즌 무료)</legend>
        {Object.entries(SUPPORT_LABEL).map(([k, v]) => (
          <Checkbox key={k} name="support" value={k} defaultChecked label={v} />
        ))}
        <p className="text-xs text-ink-soft">판매는 원하는 작가만 선택해요. 온라인 전시 페이지는 판매 없이 기록으로만 둘 수도 있어요.</p>
      </fieldset>

      <Field label="하고 싶은 말" className="sm:col-span-2"><Textarea name="message" placeholder="전시 소개, 촬영 희망 일정, 작품 철수일 등" /></Field>
      <div className="sm:col-span-2">
        <Checkbox name="agreePrivacy" label={<>전시 등록 연락을 위한 <Link href="/legal/privacy" target="_blank" className="underline">개인정보 수집 및 이용</Link>에 동의해요 (필수)</>} />
        {errors.agreePrivacy && <p className="mt-1 text-xs font-medium text-dot">{errors.agreePrivacy}</p>}
      </div>
      {errors.form && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot sm:col-span-2">{errors.form}</p>}
      <Button type="submit" size="lg" disabled={pending} className="sm:col-span-2">{pending ? "보내는 중…" : "전시 등록 신청하기"}</Button>
    </ActionForm>
  );
}
