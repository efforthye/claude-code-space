"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SHIPPING_LABEL } from "@/lib/domain/rules";
import type { ShippingMethod } from "@/lib/domain/types";
import { completeAuctionOrder, type BidState } from "./actions";

/** 낙찰자가 받는 방법, 주소, 입금자명을 채우는 칸 */
export function WonOrderForm({ orderId, options, initial }: { orderId: string; options: ShippingMethod[]; initial: { shipping: ShippingMethod; address: string; deliveryNote: string; depositorName: string } }) {
  const [state, action, pending] = useActionState<BidState, FormData>(completeAuctionOrder.bind(null, orderId), null);
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="받는 방법">
        <Select name="shipping" defaultValue={initial.shipping}>
          {options.map((o) => <option key={o} value={o}>{SHIPPING_LABEL[o]}</option>)}
        </Select>
      </Field>
      <Field label="입금자명" required>
        <Input name="depositorName" defaultValue={initial.depositorName} />
      </Field>
      <Field label="받는 주소" className="sm:col-span-2" hint="직접 수령이면 비워 두세요">
        <Input name="address" defaultValue={initial.address} />
      </Field>
      <Field label="배송 메모" className="sm:col-span-2" hint="층수, 엘리베이터, 진입로">
        <Textarea name="deliveryNote" defaultValue={initial.deliveryNote} className="min-h-16" />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>결제 정보 저장</Button>
        {state && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-ok" : "text-sm text-dot"}>{state.message}</p>}
      </div>
    </ActionForm>
  );
}
