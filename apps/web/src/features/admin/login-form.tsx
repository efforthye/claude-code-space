"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { login } from "./auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="관리자 비밀번호" error={state?.error}>
        <Input name="password" type="password" autoComplete="current-password" autoFocus required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "확인 중…" : "로그인"}</Button>
    </form>
  );
}
