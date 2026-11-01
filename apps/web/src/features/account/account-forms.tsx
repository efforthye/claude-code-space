"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { readMine } from "@/features/my/my-store";
import { changePassword, claimCodeForm, claimCodes, deleteAccount, updateProfile, type AccountFormState } from "./actions";

function Result({ state, ok }: { state: AccountFormState; ok?: string }) {
  if (state?.error) return <p role="alert" className="text-sm font-medium text-dot">{state.error}</p>;
  if (state === null && ok) return <p className="text-sm text-ink-soft">{ok}</p>;
  return null;
}

/** 다른 기기에서 받은 주문번호, 신청번호를 계정에 연결 */
export function ClaimCodeForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(claimCodeForm, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input name="code" placeholder="MAYO-ABCD2345 또는 J-, E-, Q- 번호" aria-label="연결할 번호" className="h-11 flex-1 font-mono" />
        <Button type="submit" disabled={pending}>연결</Button>
      </div>
      <Result state={state} ok="연결했어요." />
    </ActionForm>
  );
}

/** 이 기기(브라우저)에 기억된 번호들을 한 번에 연결 */
export function DeviceClaim() {
  // 서버 렌더에선 비어 있고, 브라우저에서만 이 기기의 번호를 읽는다 (문자열로 비교해 매번 새 배열이 안 생기게)
  const joined = useSyncExternalStore(
    () => () => {},
    () => readMine().map((e) => e.code).join(","),
    () => "",
  );
  const codes = joined ? joined.split(",") : [];
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  if (codes.length === 0 || done != null) {
    return done != null ? <p className="text-sm text-ink-soft">{done > 0 ? `${done}건을 연결했어요.` : "새로 연결할 건이 없어요."}</p> : null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-violet/5 p-4">
      <p className="text-sm">이 기기에서 넣은 주문, 신청 {codes.length}건이 있어요. 내 계정으로 가져올까요?</p>
      <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => setDone((await claimCodes(codes)).linked))}>
        {pending ? "연결하는 중…" : "가져오기"}
      </Button>
    </div>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateProfile, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="이름"><Input name="name" defaultValue={name} autoComplete="name" /></Field>
        <Field label="휴대폰"><Input name="phone" defaultValue={phone ?? ""} type="tel" autoComplete="tel" /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>저장</Button>
        <Result state={state} ok="저장했어요." />
      </div>
    </ActionForm>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(changePassword, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <Field label="지금 비밀번호"><Input name="currentPassword" type="password" autoComplete="current-password" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="새 비밀번호" hint="10자 이상"><Input name="newPassword" type="password" autoComplete="new-password" /></Field>
        <Field label="새 비밀번호 확인"><Input name="newPasswordConfirm" type="password" autoComplete="new-password" /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>비밀번호 바꾸기</Button>
        <Result state={state} ok="바꿨어요. 다른 기기에서는 다시 로그인해야 해요." />
      </div>
    </ActionForm>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(deleteAccount, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        계정과 로그인 정보는 바로 지워져요. 주문 기록은 전자상거래법에 따라 5년간 보관하되 계정과의 연결은 끊어요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="비밀번호"><Input name="password" type="password" autoComplete="current-password" /></Field>
        <Field label="확인" hint="탈퇴라고 적어 주세요"><Input name="confirm" placeholder="탈퇴" /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="danger" disabled={pending}>회원 탈퇴</Button>
        <Result state={state} />
      </div>
    </ActionForm>
  );
}
