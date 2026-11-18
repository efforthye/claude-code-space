"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { FormState } from "./actions";
import { createAuction, scheduleRequested } from "./auction-actions";

type Terms = { startPrice: number; increment: number; buyNowPrice: number | null };

function TermFields({ terms }: { terms?: Terms }) {
  return (
    <>
      <Field label="시작가 (원)" required><Input name="startPrice" inputMode="numeric" defaultValue={terms?.startPrice ?? ""} /></Field>
      <Field label="입찰 단위 (원)" required><Input name="increment" inputMode="numeric" defaultValue={terms?.increment ?? 10000} /></Field>
      <Field label="즉시구매가 (원)" hint="비우면 즉시구매 없음"><Input name="buyNowPrice" inputMode="numeric" defaultValue={terms?.buyNowPrice ?? ""} /></Field>
      <Field label="시작 (한국 시각)" required><Input name="startsAt" type="datetime-local" /></Field>
      <Field label="마감 (한국 시각)" required hint="전시 일정으로 한 번에 맞출 수도 있어요"><Input name="endsAt" type="datetime-local" /></Field>
    </>
  );
}

export function CreateAuctionForm({ works }: { works: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAuction, null);
  return (
    <ActionForm action={action} className="grid gap-3 rounded-md border border-line bg-paper p-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="작품" required className="sm:col-span-2 lg:col-span-3">
        <Select name="workId">
          {works.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </Select>
      </Field>
      <TermFields />
      <div className="flex items-end gap-3">
        <Button type="submit" size="sm" disabled={pending || works.length === 0}>경매 열기</Button>
        {state?.error && <p role="alert" className="text-sm text-dot">{state.error}</p>}
      </div>
    </ActionForm>
  );
}

export function ScheduleRequestForm({ auctionId, terms }: { auctionId: string; terms: Terms }) {
  const [state, action, pending] = useActionState<FormState, FormData>(scheduleRequested.bind(null, auctionId), null);
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <TermFields terms={terms} />
      <div className="flex items-end gap-3">
        <Button type="submit" size="sm" disabled={pending}>일정 정하고 열기</Button>
        {state?.error && <p role="alert" className="text-sm text-dot">{state.error}</p>}
      </div>
    </ActionForm>
  );
}
