"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Celebrate } from "@/components/ui/celebrate";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { CONSULT_KIND_LABEL, RENT_TO_OWN_CREDIT } from "@/lib/domain/rules";
import { RENTAL_MONTHS, type ConsultKind } from "@/lib/domain/types";
import { formatPrice } from "@/lib/format";
import { submitConsultation, submitRental, type RentalFormState } from "./actions";

export type RentalPick = { id: string; title: string; artistName: string; monthly: number; deposit: number; cover: string | null };

function Privacy({ error }: { error?: string }) {
  return (
    <div className="sm:col-span-2">
      <Checkbox name="agreePrivacy" label={<>상담과 계약을 위한 <Link href="/legal/privacy" target="_blank" className="underline">개인정보 수집 및 이용</Link>에 동의해요 (필수)</>} />
      {error && <p className="mt-1 text-xs font-medium text-dot">{error}</p>}
    </div>
  );
}

function BusinessFields({ errors }: { errors: Record<string, string> }) {
  return (
    <>
      <Field label="회사, 매장 이름" required error={errors.company}><Input name="company" autoComplete="organization" /></Field>
      <Field label="사업자등록번호" hint="세금계산서가 필요하면" error={errors.bizNumber}><Input name="bizNumber" inputMode="numeric" placeholder="000-00-00000" /></Field>
    </>
  );
}

/** 렌탈 신청: 고른 작품, 기간, 시작일, 연락처, 설치 장소 */
export function RentalForm({ picks, audience: initialAudience = "personal" }: { picks: RentalPick[]; audience?: "personal" | "business" }) {
  const [state, action, pending] = useActionState<RentalFormState, FormData>(submitRental, null);
  const [audience, setAudience] = useState(initialAudience);
  const [months, setMonths] = useState(3);
  const [chosen, setChosen] = useState(() => new Set(picks.map((p) => p.id)));
  const errors = state && !state.ok ? state.errors : {};
  const selected = picks.filter((p) => chosen.has(p.id));
  const monthly = selected.reduce((s, p) => s + p.monthly, 0);
  const deposit = selected.reduce((s, p) => s + p.deposit, 0);

  if (state?.ok)
    return (
      <Celebrate eyebrow="렌탈 신청 완료" title="렌탈 신청이 접수됐어요" code={state.code} codeTitle="렌탈 신청">
        작가와 설치 일정을 맞춰 하루 이틀 안에 연락드려요. 계약을 확정하기 전에는 돈을 받지 않아요.
      </Celebrate>
    );

  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">작품</legend>
        {picks.map((p) => (
          <label key={p.id} className="glass flex items-center gap-3 rounded-xl p-2.5 text-sm">
            <input
              type="checkbox"
              name="workIds"
              value={p.id}
              checked={chosen.has(p.id)}
              onChange={(e) => setChosen((c) => { const n = new Set(c); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })}
              className="size-4 accent-violet"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.cover && <img src={p.cover} alt="" className="size-12 rounded-lg object-cover" />}
            <span className="min-w-0 flex-1"><b className="block truncate">「{p.title}」</b><span className="text-ink-soft">{p.artistName}</span></span>
            <span className="shrink-0 text-right tabular-nums">월 {formatPrice(p.monthly)}</span>
          </label>
        ))}
        {errors.workIds && <p className="text-xs font-medium text-dot">{errors.workIds}</p>}
      </fieldset>

      <Field label="누가 쓰나요">
        <Select name="audience" value={audience} onChange={(e) => setAudience(e.target.value as "personal" | "business")}>
          <option value="personal">집, 개인 작업실</option>
          <option value="business">매장, 사무실, 기업 공간</option>
        </Select>
      </Field>
      <Field label="기간" required error={errors.months}>
        <Select name="months" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {RENTAL_MONTHS.map((m) => <option key={m} value={m}>{m}개월</option>)}
        </Select>
      </Field>
      <Field label="시작 희망일" required error={errors.startDate}><Input name="startDate" type="date" /></Field>
      <Field label="이름" required error={errors.name}><Input name="name" autoComplete="name" /></Field>
      {audience === "business" && <BusinessFields errors={errors} />}
      <Field label="이메일" required error={errors.email}><Input name="email" type="email" autoComplete="email" /></Field>
      <Field label="연락처" required error={errors.phone}><Input name="phone" inputMode="tel" autoComplete="tel" /></Field>
      <Field label="설치할 곳 주소" required error={errors.address} className="sm:col-span-2"><Input name="address" autoComplete="street-address" /></Field>
      <Field label="공간 설명" hint="벽 너비, 층수와 엘리베이터, 조명, 원하는 분위기" className="sm:col-span-2"><Textarea name="spaceNote" /></Field>

      <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 rounded-xl bg-ink/5 p-4 text-sm sm:col-span-2">
        <dt className="text-ink-soft">월 렌탈료</dt><dd className="tabular-nums">{formatPrice(monthly)}</dd>
        <dt className="text-ink-soft">{months}개월 렌탈료</dt><dd className="tabular-nums">{formatPrice(monthly * months)}</dd>
        <dt className="text-ink-soft">보증금 (반납 확인 후 돌려드려요)</dt><dd className="tabular-nums">{formatPrice(deposit)}</dd>
        <dt className="text-ink-soft">설치, 회수 운송비</dt><dd className="text-ink-soft">견적 후 안내</dd>
      </dl>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Checkbox
          name="agreeRental"
          label={<>렌탈 조건을 확인했어요: 작품이 상하면 수리비를 보증금에서 빼고, 렌탈 중에 사기로 하면 낸 렌탈료의 {Math.round(RENT_TO_OWN_CREDIT * 100)}%를 작품가에서 빼 드려요</>}
        />
        {errors.agreeRental && <p className="text-xs font-medium text-dot">{errors.agreeRental}</p>}
      </div>
      <Privacy error={errors.agreePrivacy} />
      {state && !state.ok && state.message && <p role="alert" className="rounded-sm bg-dot/10 p-3 text-sm text-dot sm:col-span-2">{state.message}</p>}
      <Button type="submit" size="lg" disabled={pending || selected.length === 0} className="sm:col-span-2">{pending ? "보내는 중…" : "렌탈 신청하기"}</Button>
    </ActionForm>
  );
}

/** 기업 상담과 작품 추천 받기 */
export function ConsultForm({ audience, defaultKind, kinds }: { audience: "personal" | "business"; defaultKind: ConsultKind; kinds: ConsultKind[] }) {
  const [state, action, pending] = useActionState<RentalFormState, FormData>(submitConsultation, null);
  const errors = state && !state.ok ? state.errors : {};
  if (state?.ok)
    return (
      <Celebrate eyebrow="상담 신청 완료" title={audience === "business" ? "기업 상담 신청이 접수됐어요" : "작품 추천 신청이 접수됐어요"} code={state.code} codeTitle="상담 신청">
        공간과 예산에 맞춰 작품을 골라 이메일로 제안드려요. 진행 상황은 마이페이지나 신청 번호로 볼 수 있어요.
      </Celebrate>
    );
  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="audience" value={audience} />
      <Field label="무엇을 도와드릴까요" required>
        <Select name="kind" defaultValue={defaultKind}>
          {kinds.map((k) => <option key={k} value={k}>{CONSULT_KIND_LABEL[k]}</option>)}
        </Select>
      </Field>
      {audience === "business" ? <BusinessFields errors={errors} /> : <span className="hidden sm:block" />}
      <Field label="이름" required error={errors.name}><Input name="name" autoComplete="name" /></Field>
      <Field label="이메일" required error={errors.email}><Input name="email" type="email" autoComplete="email" /></Field>
      <Field label="연락처" required error={errors.phone}><Input name="phone" inputMode="tel" autoComplete="tel" /></Field>
      <Field label="공간" hint="거실 소파 위 벽, 카페 홀 20평, 로비 등"><Input name="space" /></Field>
      <Field label="예산"><Input name="budget" placeholder={audience === "business" ? "월 50만 원 안팎" : "50만 원 이하"} /></Field>
      <Field label="기간, 일정"><Input name="period" placeholder="12월 오픈 전까지, 6개월" /></Field>
      <Field label="원하는 분위기" className="sm:col-span-2"><Input name="mood" placeholder="밝고 따뜻하게, 흙이나 나무 같은 재료" /></Field>
      <Field label="더 알려 주실 것" error={errors.message} className="sm:col-span-2"><Textarea name="message" /></Field>
      <Privacy error={errors.agreePrivacy} />
      {state && !state.ok && state.message && <p role="alert" className="rounded-sm bg-dot/10 p-3 text-sm text-dot sm:col-span-2">{state.message}</p>}
      <Button type="submit" size="lg" disabled={pending} className="sm:col-span-2">{pending ? "보내는 중…" : audience === "business" ? "상담 신청하기" : "추천 받기"}</Button>
    </ActionForm>
  );
}
