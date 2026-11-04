import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { COMMISSION_RATE, myArtist, sellerData } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { ORDER_STATUS_LABEL, SHIPPING_LABEL } from "@/lib/domain/rules";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "판매 주문", robots: { index: false } };

export default function SalesPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Sales />
    </Suspense>
  );
}

async function Sales() {
  const me = await requireUser("/account/sell/orders");
  const artist = await myArtist(me.id);
  if (!artist) redirect("/account/sell");
  const { sales, stats } = await sellerData(artist.id);
  return (
    <AccountShell me={me} mode="sell">
      <div className="grid grid-cols-2 gap-3">
        <div className="glass flex flex-col gap-1 rounded-xl p-4"><span className="text-xs font-semibold text-ink-soft">정산 예정</span><span className="text-xl font-bold">{formatPrice(stats.due)}</span></div>
        <div className="glass flex flex-col gap-1 rounded-xl p-4"><span className="text-xs font-semibold text-ink-soft">정산 완료</span><span className="text-xl font-bold">{formatPrice(stats.settled)}</span></div>
      </div>
      <Section title="판매 주문" count={sales.length}>
        <p className="text-sm text-ink-soft">
          입금이 확인된 주문만 배송 정보가 보여요. 발송이나 직접 수령 일정은 운영자와 함께 맞춰요. 이번 시즌 수수료는 {Math.round(COMMISSION_RATE * 100)}%예요.
        </p>
        {sales.length === 0 ? (
          <Empty>아직 주문이 없어요.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {sales.map((s) => (
              <li key={s.orderCode + s.workId} className="glass flex flex-col gap-3 rounded-xl p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">「{s.title}」</span>
                  <Badge tone={s.status === "pending_payment" ? "warn" : s.status === "cancelled" ? "neutral" : "ok"}>{ORDER_STATUS_LABEL[s.status]}</Badge>
                </div>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1">
                  <dt className="text-ink-soft">주문번호</dt><dd className="font-mono">{s.orderCode}</dd>
                  <dt className="text-ink-soft">주문일</dt><dd>{formatDate(s.createdAt)}</dd>
                  <dt className="text-ink-soft">받는 방법</dt><dd>{SHIPPING_LABEL[s.shipping]}</dd>
                  <dt className="text-ink-soft">정산 금액</dt><dd><b>{formatPrice(s.payout)}</b>{s.settledAt ? <span className="ml-2 text-ink-soft">{formatDate(s.settledAt)} 정산 완료</span> : s.paidAt && s.status !== "cancelled" ? <span className="ml-2 text-violet">정산 예정</span> : null}</dd>
                </dl>
                {s.buyer ? (
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="mb-1 text-xs font-semibold text-violet">배송 정보 (발송에만 써 주세요)</p>
                    <p>{s.buyer.name}, {s.buyer.phone}</p>
                    {s.buyer.address && <p>{s.buyer.address}</p>}
                    {s.buyer.note && <p className="text-ink-soft">{s.buyer.note}</p>}
                  </div>
                ) : (
                  s.status === "pending_payment" && <p className="text-xs text-ink-soft">입금이 확인되면 배송 정보가 열려요.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AccountShell>
  );
}
