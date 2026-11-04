import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { WorkImage } from "@/features/catalog/work-image";
import { myArtist, sellerData } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { WORK_STATUS_LABEL } from "@/lib/domain/rules";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "내 작품", robots: { index: false } };

export default function MyWorksPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <MyWorks />
    </Suspense>
  );
}

async function MyWorks() {
  const me = await requireUser("/account/sell/works");
  const artist = await myArtist(me.id);
  if (!artist) redirect("/account/sell");
  const { works } = await sellerData(artist.id);
  return (
    <AccountShell me={me} mode="sell">
      <Section title="내 작품" count={works.length} action={<ButtonLink href="/account/sell/works/new" size="sm">작품 올리기</ButtonLink>}>
        {works.length === 0 ? (
          <Empty>첫 작품을 올려 보세요. 운영자가 확인한 뒤 공개돼요.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {works.map((w) => {
              const locked = w.status === "reserved" || w.status === "sold";
              return (
                <li key={w.id} className="glass flex items-center gap-3 rounded-xl p-3">
                  <WorkImage src={w.cover ?? undefined} alt="" className="size-16 shrink-0 rounded-lg" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-semibold">「{w.title}」</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      {w.pendingReview ? <Badge tone="warn">검수 대기</Badge> : <Badge tone={w.status === "available" ? "ok" : "neutral"}>{WORK_STATUS_LABEL[w.status]}</Badge>}
                      <span className="text-ink-soft">{formatPrice(w.price)}</span>
                    </span>
                  </div>
                  {locked ? (
                    <span className="shrink-0 text-xs text-ink-soft">수정 불가</span>
                  ) : (
                    <Link href={`/account/sell/works/${w.id}`} className="glass shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-white">고치기</Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-ink-soft">예약 중이거나 판매된 작품은 구매자가 본 정보가 바뀌지 않도록 고칠 수 없어요. 고칠 게 있으면 문의하기로 알려 주세요.</p>
      </Section>
    </AccountShell>
  );
}
