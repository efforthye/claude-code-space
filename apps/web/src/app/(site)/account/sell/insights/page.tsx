import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { myArtist, sellerData } from "@/features/account/seller";
import { PrintButton } from "@/features/account/print-button";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "성과 리포트", robots: { index: false } };

/**
 * 작가 성과 리포트 (기능 20): 판매 성과를 숫자와 월별 막대로 보여 주고,
 * 판매 이력을 그대로 인쇄(PDF 저장)해 공모전, 지원사업 포트폴리오로 쓸 수 있게 한다.
 */
export default function InsightsPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Insights />
    </Suspense>
  );
}

async function Insights() {
  const me = await requireUser("/account/sell/insights");
  const artist = await myArtist(me.id);
  if (!artist) {
    return (
      <AccountShell me={me} mode="sell">
        <Empty>작가 페이지가 연결되면 성과 리포트가 열려요.</Empty>
      </AccountShell>
    );
  }
  const { works, sales, stats } = await sellerData(artist.id);
  const done = sales.filter((s) => s.paidAt && s.status !== "cancelled");
  const revenue = done.reduce((n, s) => n + s.price, 0);
  const avg = done.length ? Math.round(revenue / done.length) : 0;

  // 최근 6개월. 월 키는 대시보드와 같이 formatDate(한국 시간) 앞 7자리로 맞춘다
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5 + i, 15));
    return { key: formatDate(d.toISOString()).slice(0, 7), label: `${d.getUTCMonth() + 1}월` };
  });
  const byMonth = months.map(({ key, label }) => {
    const inMonth = done.filter((s) => formatDate(s.paidAt!).slice(0, 7) === key);
    return { m: key, label, count: inMonth.length, amount: inMonth.reduce((n, s) => n + s.price, 0) };
  });
  const peak = Math.max(1, ...byMonth.map((b) => b.amount));
  const sellThrough = works.length ? Math.round((stats.sold / works.length) * 100) : 0;

  const cards = [
    { label: "판매 완료", value: `${done.length}건` },
    { label: "판매 금액", value: formatPrice(revenue) },
    { label: "평균 판매가", value: formatPrice(avg) },
    { label: "판매율 (판매 완료 / 올린 작품)", value: `${sellThrough}%` },
    { label: "정산 완료", value: formatPrice(stats.settled) },
    { label: "정산 예정", value: formatPrice(stats.due) },
  ];

  return (
    <AccountShell me={me} mode="sell">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="glass flex flex-col gap-1 rounded-xl p-4">
            <span className="text-xs font-semibold text-ink-soft">{c.label}</span>
            <span className="text-xl font-bold">{c.value}</span>
          </div>
        ))}
      </div>

      <Section title="최근 6개월 판매 금액">
        <div className="glass flex h-56 items-end gap-3 rounded-xl p-5">
          {byMonth.map((b) => (
            <div key={b.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs font-semibold">{b.count ? `${b.count}건` : ""}</span>
              <div className="bg-aurora w-full max-w-14 rounded-t-lg" style={{ height: `${Math.max(4, (b.amount / peak) * 100)}%`, opacity: b.amount ? 1 : 0.25 }} />
              <span className="text-xs text-ink-soft">{b.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="작품 현황">
        <div className="glass flex flex-col gap-3 rounded-xl p-5 text-sm">
          {[
            { label: "판매 중", n: stats.available, cls: "bg-violet" },
            { label: "예약 중", n: stats.reserved, cls: "bg-amber-400" },
            { label: "판매 완료", n: stats.sold, cls: "bg-pink-500" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-semibold">{r.label}</span>
              <div className="h-2.5 flex-1 rounded-full bg-mist">
                <div className={`h-2.5 rounded-full ${r.cls}`} style={{ width: `${works.length ? (r.n / works.length) * 100 : 0}%` }} />
              </div>
              <span className="w-10 text-right font-bold">{r.n}점</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="판매 이력 포트폴리오" action={<PrintButton />}>
        {done.length === 0 ? (
          <Empty>판매가 생기면 날짜와 금액이 여기에 쌓여요. 인쇄 버튼으로 PDF로 저장해 공모전, 지원사업 자료로 쓸 수 있어요.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {done.map((s) => (
              <li key={s.orderCode + s.workId} className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 text-sm">
                <span className="font-semibold">「{s.title}」</span>
                <span className="flex items-center gap-3">
                  <span className="text-ink-soft">{formatDate(s.paidAt!)} 판매</span>
                  <b>{formatPrice(s.price)}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AccountShell>
  );
}
