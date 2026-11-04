import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { myAccountData } from "@/features/account/queries";
import { myArtist, sellerData } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "판매", robots: { index: false } };

export default function SellPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Sell />
    </Suspense>
  );
}

async function Sell() {
  const me = await requireUser("/account/sell");
  const artist = await myArtist(me.id);
  if (!artist) {
    const { requests } = await myAccountData(me.id);
    const applications = requests.filter((r) => r.code.startsWith("J-"));
    return (
      <AccountShell me={me} mode="sell">
        <Section title="작가로 판매하기">
          {applications.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {applications.map((a) => (
                <li key={a.code} className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-4">
                  <span className="font-semibold">{a.title}</span>
                  <Badge tone={a.tone}>{a.state}</Badge>
                </li>
              ))}
              <p className="text-sm text-ink-soft">승인되면 이 계정에 작가 페이지가 연결되고, 여기서 작품을 올리고 판매를 관리할 수 있어요.</p>
            </ul>
          ) : (
            <Empty>
              <p className="font-semibold text-ink">아직 이 계정에 연결된 작가 페이지가 없어요</p>
              <p className="mt-1">입점 신청이 승인되면 판매 화면이 열려요. 이미 MAYO 작가라면 문의하기로 이 계정 이메일을 알려 주세요.</p>
              <div className="mt-4 flex justify-center gap-2">
                <ButtonLink href="/join">작가 입점 신청</ButtonLink>
                <ButtonLink href="/contact" variant="secondary">문의하기</ButtonLink>
              </div>
            </Empty>
          )}
        </Section>
      </AccountShell>
    );
  }

  const { stats, sales } = await sellerData(artist.id);
  const cards = [
    { label: "판매 중", value: `${stats.available}점` },
    { label: "예약 중", value: `${stats.reserved}점` },
    { label: "판매 완료", value: `${stats.sold}점` },
    { label: "정산 예정", value: formatPrice(stats.due) },
  ];
  return (
    <AccountShell me={me} mode="sell">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass flex flex-col gap-1 rounded-xl p-4">
            <span className="text-xs font-semibold text-ink-soft">{c.label}</span>
            <span className="text-xl font-bold">{c.value}</span>
          </div>
        ))}
      </div>
      {stats.pending > 0 && (
        <p className="rounded-xl bg-violet/8 p-4 text-sm">검수를 기다리는 작품이 {stats.pending}점 있어요. 운영자가 확인하면 공개돼요.</p>
      )}
      <Section title="최근 판매" action={<Link href="/account/sell/orders" className="link-sweep text-sm font-semibold text-violet">전체 보기 →</Link>}>
        {sales.length === 0 ? (
          <Empty>아직 주문이 없어요. 작품 사진과 설명을 채우면 컬렉터가 찾기 쉬워져요.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {sales.slice(0, 5).map((s) => (
              <li key={s.orderCode + s.workId} className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 text-sm">
                <span className="font-semibold">「{s.title}」</span>
                <span className="flex items-center gap-2">
                  <span className="text-ink-soft">{formatDate(s.createdAt)}</span>
                  <Badge tone={s.status === "pending_payment" ? "warn" : s.status === "cancelled" ? "neutral" : "ok"}>{ORDER_STATUS_LABEL[s.status]}</Badge>
                  <b>{formatPrice(s.price)}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/account/sell/works/new">작품 올리기</ButtonLink>
        <ButtonLink href="/account/sell/profile" variant="secondary">작가 프로필 꾸미기</ButtonLink>
      </div>
    </AccountShell>
  );
}
