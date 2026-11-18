"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { requestAuction, type BidState } from "./actions";

/** 판매자: 이 작품을 졸전 경매로 내기 */
export function AuctionRequestForm({ workId, price }: { workId: string; price: number }) {
  const [state, action, pending] = useActionState<BidState, FormData>(requestAuction.bind(null, workId), null);
  if (state?.ok) return <p role="status" className="text-sm text-ok">{state.message}</p>;
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-3">
      <Field label="시작가 (원)" required hint="낮을수록 첫 입찰이 쉬워요">
        <Input name="startPrice" inputMode="numeric" defaultValue={Math.max(10_000, Math.round((price * 0.5) / 10_000) * 10_000)} />
      </Field>
      <Field label="입찰 단위">
        <Select name="increment" defaultValue="10000">
          {[5_000, 10_000, 20_000, 50_000].map((v) => <option key={v} value={v}>{v.toLocaleString("ko-KR")}원</option>)}
        </Select>
      </Field>
      <Field label="즉시구매가 (원)" hint="비우면 즉시구매 없음">
        <Input name="buyNowPrice" inputMode="numeric" defaultValue={price} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>경매 신청</Button>
        {state && !state.ok && <p role="alert" className="text-sm text-dot">{state.message}</p>}
      </div>
    </ActionForm>
  );
}
