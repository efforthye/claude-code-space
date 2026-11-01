"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { addCategory, type FormState } from "./actions";

export function CategoryAddForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addCategory, null);
  return (
    <ActionForm action={action} className="glass flex flex-wrap items-end gap-3 rounded-lg p-4">
      <Field label="코드" hint="영문 소문자, 예: glass"><Input name="id" placeholder="glass" /></Field>
      <Field label="이름"><Input name="label" placeholder="유리" /></Field>
      <Checkbox name="artShipping" label="전문 운송" className="mb-3" />
      <Button type="submit" disabled={pending}>분류 추가</Button>
      {state?.error && <p className="w-full text-sm text-dot">{state.error}</p>}
    </ActionForm>
  );
}
