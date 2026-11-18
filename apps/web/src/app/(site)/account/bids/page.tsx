import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { acceptOffer, declineOffer } from "@/features/auction/actions";
import { WonOrderForm } from "@/features/auction/my-bids";
import { requestNow, settleDueAuctions } from "@/features/auction/server";
import { getBankAccount } from "@/features/orders/payment";
import { store } from "@/lib/data/store";
import { auctionPhase, standing } from "@/lib/domain/auction";
import { artShippingIds, orderTotal, shippingOptions } from "@/lib/domain/rules";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "내 경매", robots: { index: false } };

export default function MyBidsPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <MyBids />
    </Suspense>
  );
}

async function MyBids() {
  const me = await requireUser("/account/bids");
  await settleDueAuctions();
  const db = await store.read();
  const now = requestNow();
  const mine = db.auctions.filter((a) => a.maxes.some((m) => m.userId === me.id) || a.offer?.userId === me.id || (a.result?.kind === "sold" && a.result.userId === me.id));
  const offers = mine.filter((a) => a.offer?.userId === me.id);
  const won = mine.filter((a) => a.result?.kind === "sold" && a.result.userId === me.id);
  const bidding = mine.filter((a) => a.state === "scheduled");
  const lost = mine.filter((a) => a.state === "closed" && !won.includes(a) && !offers.includes(a));
  const bank = getBankAccount();
  const work = (id: string) => db.works.find((w) => w.id === id);

  return (
    <AccountShell me={me} mode="buy">
      {offers.length > 0 && (
        <Section title="구매 제안" count={offers.length}>
          <ul className="flex flex-col gap-2">
            {offers.map((a) => (
              <li key={a.id} className="glass flex flex-col gap-3 rounded-xl p-4">
                <p>
                  <b>「{work(a.workId)?.title}」</b> 낙찰자가 결제하지 않아, 입찰하신 최대 금액 <b>{formatPrice(a.offer!.amount)}</b>으로 구매하실 수 있어요.
                </p>
                <p className="text-xs text-ink-soft">{formatDateTime(a.offer!.expiresAt)}까지 답해 주세요. 구매 수수료가 더해져요.</p>
                <div className="flex gap-2">
                  <form action={acceptOffer.bind(null, a.id)}><Button size="sm" type="submit">이 금액에 구매</Button></form>
                  <form action={declineOffer.bind(null, a.id)}><Button size="sm" variant="secondary" type="submit">거절</Button></form>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="낙찰" count={won.length}>
        {won.length === 0 ? (
          <Empty>낙찰받은 작품이 여기 모여요.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {won.map((a) => {
              const r = a.result as Extract<NonNullable<typeof a.result>, { kind: "sold" }>;
              const o = db.orders.find((x) => x.id === r.orderId);
              const w = work(a.workId);
              if (!o || !w) return null;
              return (
                <li key={a.id} className="glass flex flex-col gap-3 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/works/${w.id}`} className="font-semibold hover:underline">「{w.title}」</Link>
                    <Badge tone={r.payment === "paid" ? "ok" : r.payment === "failed" ? "warn" : undefined}>{r.payment === "paid" ? "완납" : r.payment === "failed" ? "낙찰 취소" : "입금 대기"}</Badge>
                  </div>
                  <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
                    <dt className="text-ink-soft">낙찰가</dt><dd>{formatPrice(r.hammer)}</dd>
                    <dt className="text-ink-soft">구매 수수료</dt><dd>{formatPrice(o.buyerFee ?? 0)}</dd>
                    {o.parcelFee > 0 && (<><dt className="text-ink-soft">택배비</dt><dd>{formatPrice(o.parcelFee)}</dd></>)}
                    <dt className="font-semibold">입금하실 금액</dt><dd className="font-bold">{formatPrice(orderTotal(o))}</dd>
                    <dt className="text-ink-soft">주문번호</dt><dd><Link href={`/orders/${o.code}`} className="font-mono underline underline-offset-4">{o.code}</Link></dd>
                    {o.status === "pending_payment" && (<><dt className="text-ink-soft">입금 기한</dt><dd>{formatDateTime(o.paymentDueAt)}</dd></>)}
                    {o.status === "pending_payment" && bank && (<><dt className="text-ink-soft">입금 계좌</dt><dd>{bank.bankName} {bank.accountNumber} ({bank.accountHolder})</dd></>)}
                  </dl>
                  {o.status === "pending_payment" && (
                    <WonOrderForm
                      orderId={o.id}
                      options={shippingOptions(w, artShippingIds(db.categories))}
                      initial={{ shipping: o.items[0].shipping, address: o.buyer.address, deliveryNote: o.buyer.deliveryNote, depositorName: o.depositorName }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="입찰 중" count={bidding.length}>
        {bidding.length === 0 ? (
          <Empty>
            참여 중인 경매가 없어요. <Link href="/auctions" className="underline underline-offset-4">진행 중인 경매 보기</Link>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {bidding.map((a) => {
              const { leader, price } = standing(a);
              const max = a.maxes.find((m) => m.userId === me.id)?.max;
              const phase = auctionPhase(a, now);
              return (
                <li key={a.id} className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 text-sm">
                  <Link href={`/works/${a.workId}`} className="font-semibold hover:underline">「{work(a.workId)?.title}」</Link>
                  <span className="flex flex-wrap items-center gap-2">
                    현재 {formatPrice(price)}, 내 최대 {formatPrice(max ?? 0)}
                    {phase === "live" && (leader === me.id ? <Badge tone="ok">최고 입찰 중</Badge> : <Badge tone="warn">밀림</Badge>)}
                    <span className="text-xs text-ink-soft">마감 {formatDateTime(a.endsAt)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {lost.length > 0 && (
        <Section title="끝난 경매" count={lost.length}>
          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
            {lost.map((a) => (
              <li key={a.id}>「{work(a.workId)?.title}」 {a.result?.kind === "sold" ? `${formatPrice(a.result.hammer)}에 다른 분이 낙찰` : "유찰"}</li>
            ))}
          </ul>
        </Section>
      )}
    </AccountShell>
  );
}
