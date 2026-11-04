"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { requestVerification, type SellerFormState } from "./seller-actions";

const METHODS = [
  { id: "school_email", title: "학교 이메일", desc: "ac.kr, edu로 끝나는 학교 메일 주소. 운영자가 확인 메일을 보내요" },
  { id: "student_id", title: "학생증, 증명서", desc: "사진을 올리면 운영자만 보고, 확인이 끝나면 바로 지워요" },
  { id: "roster", title: "졸업전시 명단", desc: "이름이 실린 졸업전시를 알려 주시면 명단에서 찾아요" },
] as const;

export function VerifyForm() {
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("school_email");
  const [state, action, pending] = useActionState<SellerFormState, FormData>(requestVerification, undefined);
  if (state === null) {
    return <div className="glass rounded-xl p-6 text-center"><p className="font-bold">인증 신청을 받았어요</p><p className="mt-1 text-sm text-ink-soft">보통 1~2일 안에 확인해요. 결과는 이 화면에 나와요.</p></div>;
  }
  return (
    <ActionForm action={action} className="glass grid gap-5 rounded-xl p-5 sm:grid-cols-2">
      <Field label="학교" required><Input name="schoolName" placeholder="홍익대학교" /></Field>
      <Field label="학과" required><Input name="department" placeholder="회화과" /></Field>
      <Field label="지금 상태" required>
        <Select name="status" defaultValue="student">
          <option value="student">재학생</option>
          <option value="graduate">졸업생</option>
        </Select>
      </Field>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-semibold">확인 방법</legend>
        <input type="hidden" name="method" value={method} />
        <div className="grid gap-2 sm:grid-cols-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={method === m.id}
              onClick={() => setMethod(m.id)}
              className={cn("flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors", method === m.id ? "border-violet bg-violet/5" : "border-ink/10 bg-white/70 hover:bg-white")}
            >
              <span className="text-sm font-bold">{m.title}</span>
              <span className="text-xs text-ink-soft">{m.desc}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {method === "school_email" && <Field label="학교 이메일" className="sm:col-span-2"><Input name="schoolEmail" type="email" placeholder="you@g.hongik.ac.kr" /></Field>}
      {method === "student_id" && (
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">학생증이나 재학, 졸업 증명서 사진</span>
          <input type="file" name="document" accept="image/jpeg,image/png,image/webp,image/avif" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
          <span className="text-xs text-ink-soft">주민등록번호 뒷자리는 가리고 올려 주세요. 공개되지 않고, 확인이 끝나면 바로 지워요.</span>
        </label>
      )}
      {method === "roster" && <Field label="이름이 실린 졸업전시" className="sm:col-span-2"><Input name="rosterNote" placeholder="2026 홍익대 회화과 졸업전시 《Pli-over-Pli》" /></Field>}
      <div className="sm:col-span-2">
        <Checkbox name="agree" label={<>학교 확인을 위한 <Link href="/legal/privacy" target="_blank" className="underline">개인정보 수집 및 이용</Link>에 동의해요 (필수)</>} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "보내는 중…" : "인증 신청"}</Button>
        {state?.error && <p role="alert" className="text-sm font-medium text-dot">{state.error}</p>}
      </div>
    </ActionForm>
  );
}
