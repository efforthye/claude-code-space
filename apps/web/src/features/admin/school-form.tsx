"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addSchool, type FormState } from "./actions";

export function SchoolForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addSchool, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-paper p-4">
      <Field label="학교 이름" required><Input name="name" placeholder="홍익대학교" /></Field>
      <Field label="짧은 이름" hint="비우면 자동"><Input name="shortName" placeholder="홍익대" /></Field>
      <Button type="submit" disabled={pending}>추가</Button>
      {state?.error && <p className="w-full text-sm text-dot">{state.error}</p>}
    </form>
  );
}
