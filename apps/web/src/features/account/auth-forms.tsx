"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { login, signup, type AccountFormState } from "./actions";

function FormError({ state }: { state: AccountFormState }) {
  if (!state?.error) return null;
  return <p role="alert" className="rounded-md bg-dot/10 p-3 text-sm font-medium text-dot">{state.error}</p>;
}

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<AccountFormState, FormData>(login, null);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <Field label="이메일"><Input name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} /></Field>
      <Field label="비밀번호"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "확인하는 중…" : "로그인"}</Button>
      <p className="text-center text-sm text-ink-soft">
        처음이신가요? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-sweep font-semibold text-violet">회원가입</Link>
      </p>
      <p className="text-center text-xs text-ink-soft">
        가입 없이 주문하셨나요? <Link href="/my" className="link-sweep font-semibold">비회원 주문 조회</Link>
      </p>
    </ActionForm>
  );
}

export function SignupForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<AccountFormState, FormData>(signup, null);
  const f = state?.fields;
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <Field label="이메일" required><Input name="email" type="email" autoComplete="email" required defaultValue={f?.email} /></Field>
      <Field label="비밀번호" required hint="10자 이상. 문장처럼 길게 쓰면 외우기 쉽고 안전해요">
        <Input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
      </Field>
      <Field label="비밀번호 확인" required><Input name="passwordConfirm" type="password" autoComplete="new-password" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름" required><Input name="name" autoComplete="name" required defaultValue={f?.name} /></Field>
        <Field label="출생연도" required hint="만 14세 이상 가입 가능"><Input name="birthYear" inputMode="numeric" placeholder="2001" required defaultValue={f?.birthYear} /></Field>
      </div>
      <Field label="휴대폰" hint="선택. 주문할 때 자동으로 채워져요"><Input name="phone" type="tel" autoComplete="tel" defaultValue={f?.phone} /></Field>
      <div className="flex flex-col gap-2 rounded-md bg-white/60 p-4">
        <Checkbox name="agreeTerms" label={<><Link href="/legal/terms" className="underline underline-offset-2" target="_blank">이용약관</Link>에 동의해요 (필수)</>} />
        <Checkbox name="agreePrivacy" label={<><Link href="/legal/privacy" className="underline underline-offset-2" target="_blank">개인정보 수집 및 이용</Link>에 동의해요 (필수)</>} />
      </div>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "가입하는 중…" : "가입하기"}</Button>
      <p className="text-center text-sm text-ink-soft">
        이미 계정이 있나요? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-sweep font-semibold text-violet">로그인</Link>
      </p>
    </ActionForm>
  );
}
