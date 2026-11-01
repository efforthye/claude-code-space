"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addArtistGroup, type FormState } from "./actions";

export function ArtistGroupAddForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addArtistGroup, null);
  return (
    <ActionForm action={action} className="glass flex flex-wrap items-end gap-3 rounded-lg p-4">
      <Field label="코드" hint="영문 소문자, 예: master"><Input name="id" placeholder="master" /></Field>
      <Field label="이름"><Input name="label" placeholder="원로 작가" /></Field>
      <Button type="submit" disabled={pending}>구분 추가</Button>
      {state?.error && <p className="w-full text-sm text-dot">{state.error}</p>}
    </ActionForm>
  );
}
