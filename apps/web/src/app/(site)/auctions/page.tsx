import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { WorkImage } from "@/features/catalog/work-image";
import { Countdown } from "@/features/auction/countdown";
import { requestNow, settleDueAuctions } from "@/features/auction/server";
import { store } from "@/lib/data/store";
import { auctionPhase, standing } from "@/lib/domain/auction";
import { coverImage } from "@/lib/domain/rules";
import type { Auction, Database } from "@/lib/domain/types";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "졸전 경매",
  description: "졸업전시 기간에만 열리는 학생 작가 작품 경매. 전시장에서 보고, 그 자리에서 입찰하세요.",
};

export default function AuctionsPage() {
  return (
    <Container className="flex flex-col gap-10 py-10">
      <PageHeading
        eyebrow="Auction"
        title="졸전 경매"
        description={<>졸업전시가 열리는 일주일 동안만 입찰을 받아요. 마지막 날 저녁 6시부터 작품마다 2분 간격으로 마감해요. <Link href="/legal/auction" className="underline underline-offset-4">경매 이용 약관</Link></>}
      />
      <Suspense fallback={<p className="text-ink-soft">경매를 불러오는 중…</p>}>
        <AuctionLists />
      </Suspense>
      <Link href="/auctions/results" className="w-fit text-sm font-semibold text-violet underline underline-offset-4">지난 경매 결과 (낙찰가, 완납 여부 공시)</Link>
    </Container>
  );
}

async function AuctionLists() {
  await connection();
  await settleDueAuctions();
  const db = await store.read();
  const now = requestNow();
  const visible = db.auctions.filter((a) => a.state === "scheduled" && !db.works.find((w) => w.id === a.workId)?.sample);
  const live = visible.filter((a) => auctionPhase(a, now) === "live").sort((a, b) => a.endsAt.localeCompare(b.endsAt));
  const upcoming = visible.filter((a) => auctionPhase(a, now) === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (live.length + upcoming.length === 0) {
    return (
      <EmptyState title="지금 열린 경매가 없어요">
        졸업전시 시즌에 다시 열려요. 그동안은 <Link href="/works" className="underline underline-offset-4">작품</Link>을 정가로 살 수 있어요.
      </EmptyState>
    );
  }
  return (
    <>
      {live.length > 0 && <Section title="진행 중" rows={live} db={db} mode="live" />}
      {upcoming.length > 0 && <Section title="곧 시작" rows={upcoming} db={db} mode="upcoming" />}
    </>
  );
}

function Section({ title, rows, db, mode }: { title: string; rows: Auction[]; db: Database; mode: "live" | "upcoming" }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-ink pb-3 text-xl font-bold">{title} <span className="text-ink-soft">{rows.length}</span></h2>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {rows.map((a) => {
          const w = db.works.find((x) => x.id === a.workId);
          if (!w) return null;
          const artist = db.artists.find((x) => x.id === w.artistId);
          const { price } = standing(a);
          return (
            <li key={a.id} className="min-w-0">
              <Link href={`/works/${w.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-white/60">
                  <WorkImage src={coverImage(w)} alt={w.title} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  <span className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-xl bg-ink/80 px-3 py-1.5 text-xs text-white backdrop-blur">
                    {mode === "live" ? (a.endsAt !== a.originalEndsAt ? "연장됨" : "마감까지") : "시작까지"}
                    <Countdown to={mode === "live" ? a.endsAt : a.startsAt} className="font-bold tabular-nums" />
                  </span>
                </div>
                <span className="truncate font-semibold">{w.title}</span>
                <span className="-mt-1.5 truncate text-[13px] text-ink-soft">{artist?.name}</span>
                <span className="flex items-baseline justify-between text-sm">
                  <b className="tabular-nums">{formatPrice(price)}</b>
                  <span className="text-xs text-ink-soft">{mode === "live" ? `입찰 ${a.bids.length}회` : formatDateTime(a.startsAt)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
