import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { changeOrderStatus, updateOrderDetails } from "@/features/admin/actions";
import { AdminHeading } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { ORDER_NEXT, ORDER_STATUS_LABEL, SHIPPING_LABEL } from "@/lib/domain/rules";
import { formatDateTime, formatPrice } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  paid: "입금 확인",
  preparing: "배송 준비 시작",
  shipped: "발송 처리",
  completed: "전달 완료",
  cancelled: "주문 취소",
};

export default async function AdminOrder(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const db = await adminDb();
  const order = db.orders.find((o) => o.id === id);
  if (!order) notFound();
  const total = order.subtotal + order.parcelFee + (order.shippingQuote ?? 0);
  const hasArt = order.items.some((i) => i.shipping === "art_shipping");

  return (
    <>
      <AdminHeading
        title={`주문 ${order.code}`}
        description={<>신청 {formatDateTime(order.createdAt)} · 입금 기한 {formatDateTime(order.paymentDueAt)}</>}
        action={<Badge tone={order.status === "pending_payment" ? "warn" : "ok"}>{ORDER_STATUS_LABEL[order.status]}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-md border border-line bg-paper p-4">
            <h2 className="mb-3 font-bold">작품</h2>
            <ul className="divide-y divide-line text-sm">
              {order.items.map((i) => (
                <li key={i.workId} className="flex justify-between gap-2 py-2">
                  <span><Link href={`/admin/works/${i.workId}`} className="underline">「{i.title}」</Link> · {i.artistName}{i.edition && ` · ed. ${i.edition}`} · {SHIPPING_LABEL[i.shipping]}</span>
                  <span className="font-semibold">{formatPrice(i.price)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>작품 합계</dt><dd>{formatPrice(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>일반 택배비</dt><dd>{formatPrice(order.parcelFee)}</dd></div>
              {hasArt && <div className="flex justify-between"><dt>전문 운송비</dt><dd>{order.shippingQuote == null ? "견적 전" : formatPrice(order.shippingQuote)}</dd></div>}
              <div className="flex justify-between font-bold"><dt>입금받을 금액</dt><dd>{formatPrice(total)}</dd></div>
            </dl>
          </section>

          <section className="rounded-md border border-line bg-paper p-4 text-sm">
            <h2 className="mb-3 font-bold">구매자 (운영자만 보는 정보)</h2>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
              <dt className="text-ink-soft">이름</dt><dd>{order.buyer.name}</dd>
              <dt className="text-ink-soft">입금자명</dt><dd className="font-semibold">{order.depositorName}</dd>
              <dt className="text-ink-soft">휴대폰</dt><dd>{order.buyer.phone}</dd>
              <dt className="text-ink-soft">이메일</dt><dd>{order.buyer.email}</dd>
              <dt className="text-ink-soft">주소</dt><dd>{order.buyer.address || "—"}</dd>
              {order.buyer.deliveryNote && (<><dt className="text-ink-soft">운송 참고</dt><dd className="whitespace-pre-line">{order.buyer.deliveryNote}</dd></>)}
            </dl>
          </section>

          <section className="rounded-md border border-line bg-paper p-4 text-sm">
            <h2 className="mb-3 font-bold">처리 기록</h2>
            <ol className="flex flex-col gap-1.5">
              {order.history.map((h, i) => (
                <li key={i} className="flex gap-3"><span className="w-32 shrink-0 text-ink-soft">{formatDateTime(h.at)}</span><span><b>{ORDER_STATUS_LABEL[h.status]}</b> · {h.note}</span></li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {ORDER_NEXT[order.status].length > 0 && (
            <section className="flex flex-col gap-3 rounded-md border-2 border-ink bg-paper p-4">
              <h2 className="font-bold">상태 바꾸기</h2>
              {ORDER_NEXT[order.status].map((next) => (
                <form key={next} action={changeOrderStatus.bind(null, order.id, next)} className="flex flex-col gap-2">
                  {next === "paid" && <p className="text-xs text-ink-soft">통장에 <b>{order.depositorName}</b> 이름으로 <b>{formatPrice(total)}</b>이 들어왔는지 확인해 주세요.</p>}
                  <Input name="note" placeholder="메모 (선택) — 예: 송장번호, 취소 사유" />
                  <Button type="submit" variant={next === "cancelled" ? "danger" : "primary"}>{ACTION_LABEL[next]}</Button>
                </form>
              ))}
            </section>
          )}
          <form action={updateOrderDetails.bind(null, order.id)} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4">
            <h2 className="font-bold">운송 견적 · 메모</h2>
            {hasArt && (
              <Field label="미술품 전문 운송비 (원)" hint="운송 업체 견적을 받아 넣으면 구매자 주문 화면 금액에 더해져요">
                <Input name="shippingQuote" inputMode="numeric" defaultValue={order.shippingQuote ?? ""} />
              </Field>
            )}
            <Field label="관리자 메모"><Textarea name="adminMemo" defaultValue={order.adminMemo} /></Field>
            <Button type="submit" variant="secondary">저장</Button>
          </form>
        </div>
      </div>
    </>
  );
}
