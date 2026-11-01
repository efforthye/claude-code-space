"use client";

import { ActionForm } from "@/components/ui/action-form";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { submitApplication, type ApplicationFormState } from "./actions";

export function JoinForm() {
  const [state, action, pending] = useActionState<ApplicationFormState, FormData>(submitApplication, null);
  const [birthYear, setBirthYear] = useState("");
  const errors = state && !state.ok ? state.errors : {};
  const year = Number(birthYear);
  const maybeMinor = /^\d{4}$/.test(birthYear) && new Date().getFullYear() - year - 1 < 19;

  if (state?.ok)
    return (
      <div className="flex flex-col gap-3 rounded-md border-2 border-ink bg-paper p-6">
        <h2 className="text-lg font-bold">입점 신청이 접수됐어요</h2>
        <p className="text-sm text-ink-soft">
          운영자가 확인한 뒤 입력하신 이메일·연락처로 촬영 일정과 학교 인증 방법을 안내드려요. 학생증 등 인증 서류는 확인 후 바로
          파기합니다.
        </p>
        <Link href="/" className="text-sm font-semibold underline underline-offset-4">홈으로</Link>
      </div>
    );

  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="이름 또는 작가명" required error={errors.name}><Input name="name" /></Field>
      <Field label="구분" required>
        <Select name="status" defaultValue="student">
          <option value="student">재학생</option>
          <option value="graduate">졸업생</option>
          <option value="aspiring">미대 지망생</option>
          <option value="general">일반 작가</option>
        </Select>
      </Field>
      <Field label="이메일" required error={errors.email} hint="졸업 후에도 쓰는 개인 이메일을 적어 주세요"><Input name="email" type="email" /></Field>
      <Field label="휴대폰" required error={errors.phone}><Input name="phone" inputMode="tel" placeholder="010-0000-0000" /></Field>
      <Field label="학교" error={errors.schoolName}><Input name="schoolName" placeholder="홍익대학교" /></Field>
      <Field label="학과"><Input name="department" placeholder="회화과" /></Field>
      <Field label="졸업(예정) 연도"><Input name="gradYear" inputMode="numeric" placeholder="2027" /></Field>
      <Field label="출생연도" required error={errors.birthYear} hint="만 14세 미만은 신청할 수 없어요">
        <Input name="birthYear" inputMode="numeric" placeholder="2003" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
      </Field>

      {maybeMinor && (
        <fieldset className="flex flex-col gap-3 rounded-md border border-warn bg-warn-soft p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-bold text-warn">만 19세 미만 — 보호자 동의가 필요해요</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="보호자 이름" required error={errors.guardianName}><Input name="guardianName" /></Field>
            <Field label="보호자 연락처" required><Input name="guardianPhone" inputMode="tel" /></Field>
          </div>
          <Checkbox name="guardianConsent" label="보호자가 입점과 작품 판매, 판매 대금 정산에 동의했어요 (정산 시 보호자를 다시 확인해요)" />
        </fieldset>
      )}

      <Field label="인스타그램" hint="@없이 아이디만"><Input name="instagram" placeholder="my.studio" /></Field>
      <Field label="포트폴리오 링크" error={errors.portfolioUrl}><Input name="portfolioUrl" placeholder="https://" /></Field>
      <Field label="작품 소개 · 하고 싶은 말" className="sm:col-span-2">
        <Textarea name="message" placeholder="어떤 작업을 하는지, 판매하고 싶은 작품(크기·매체)이 있다면 알려 주세요" />
      </Field>

      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:col-span-2">
        <Checkbox name="agreePrivacy" label={<>입점 심사·연락을 위한 <Link href="/legal/privacy" target="_blank" className="underline">개인정보 수집·이용</Link>에 동의해요 (필수)</>} />
        <Checkbox name="agreeImage" label="판매·홍보와 컬렉터의 소장 인증샷 공유를 위해 MAYO가 작품 이미지를 이용하는 데 동의해요. 저작권은 작가에게 남아요 (필수)" />
        {(errors.agreePrivacy || errors.agreeImage) && <p className="text-xs font-medium text-dot">{errors.agreePrivacy ?? errors.agreeImage}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="sm:col-span-2">{pending ? "보내는 중…" : "입점 신청하기"}</Button>
    </ActionForm>
  );
}
