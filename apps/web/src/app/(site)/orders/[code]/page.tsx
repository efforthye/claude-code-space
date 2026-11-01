import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { getBankAccount } from "@/features/orders/payment";
import { findOrderByCode } from "@/features/orders/queries";
import { ORDER_STATUS_LABEL, SHIPPING_LABEL } from "@/lib/domain/rules";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "주문 확인", robots: { index: false } };

export default function OrderPage(props: PageProps<"/orders/[code]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">주문을 불러오는 중…</Container>}>
      <OrderDetail params={props.params} />
    </Suspense>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/orders/[code]">["params"] }) {
  const { code } = await params;
  const order = await findOrderByCode(decodeURIComponent(code));
  if (!order) notFound();
  const bank = getBankAccount();
  const amount = order.subtotal + order.parcelFee + (order.shippingQuote ?? 0);
  const awaitingQuote = order.items.some((i) => i.shipping === "art_shipping") && order.shippingQuote == null;

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-12">
      <header className="flex flex-col gap-2 border-b border-ink pb-5">
        <Badge tone={order.status === "cancelled" ? "neutral" : order.status === "pending_payment" ? "warn" : "ok"} className="w-fit">
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
        <h1 className="text-2xl font-bold">
          {order.status === "pending_payment" ? "주문 신청이 접수됐어요" : "주문 상태"}
        </h1>
        <p className="text-sm text-ink-soft">주문번호 <b className="text-ink">{order.code}</b> · {formatDateTime(order.createdAt)} — 주문 조회에 필요하니 보관해 주세요.</p>
      </header>

      {order.status === "pending_payment" && (
        <section className="flex flex-col gap-3 rounded-md border-2 border-ink bg-paper p-5">
          <h2 className="font-bold">입금 안내</h2>
          {bank ? (
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-ink-soft">은행</dt><dd>{bank.bankName}</dd>
              <dt className="text-ink-soft">계좌번호</dt><dd className="font-bold tracking-wide">{bank.accountNumber}</dd>
              <dt className="text-ink-soft">예금주</dt><dd>{bank.accountHolder}</dd>
              <dt className="text-ink-soft">입금 금액</dt><dd className="font-bold">{formatPrice(amount)}</dd>
              <dt className="text-ink-soft">입금자명</dt><dd>{order.depositorName}</dd>
              <dt className="text-ink-soft">입금 기한</dt><dd>{formatDateTime(order.paymentDueAt)}</dd>
            </dl>
          ) : (
            <p className="text-sm">입금 계좌는 입력하신 연락처로 따로 안내드릴게요.</p>
          )}
          {awaitingQuote && (
            <p className="rounded-sm bg-warn-soft p-3 text-xs text-warn">
              미술품 전문 운송 작품이 있어요. 운송 견적을 받아 연락드리며, 운송비는 견적에 동의하신 뒤에 따로 받습니다.
            </p>
          )}
          <p className="text-xs text-ink-soft">입금이 확인되면 상태가 ‘입금 확인’으로 바뀌고, 작가와 배송·수령 일정을 조율해 연락드려요.</p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">주문 작품</h2>
        <ul className="flex flex-col divide-y divide-line border-y border-line text-sm">
          {order.items.map((i) => (
            <li key={i.workId} className="flex justify-between gap-3 py-3">
              <span>「{i.title}」 · {i.artistName}{i.edition && ` · ed. ${i.edition}`} <span className="text-ink-soft">· {SHIPPING_LABEL[i.shipping]}</span></span>
              <span className="font-semibold">{formatPrice(i.price)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between"><dt>일반 택배비</dt><dd>{formatPrice(order.parcelFee)}</dd></div>
          {order.shippingQuote != null && <div className="flex justify-between"><dt>미술품 전문 운송비</dt><dd>{formatPrice(order.shippingQuote)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>합계</dt><dd>{formatPrice(amount)}{awaitingQuote && " + 운송비"}</dd></div>
        </dl>
      </section>
    </Container>
  );
}
