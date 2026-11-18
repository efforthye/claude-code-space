import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { settleDueAuctions } from "@/features/auction/server";
import { store } from "@/lib/data/store";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "경매 결과 공시" };

const PAYMENT = { pending: "결제 기다리는 중", paid: "완납", failed: "미납 (낙찰 취소)" } as const;
const VIA = { bid: "경매 낙찰", buy_now: "즉시구매", second_chance: "차순위 구매" } as const;

/** 미술진흥법 제15조⑤2: 낙찰된 미술품의 낙찰가격과 경매대금의 완납 여부 공시. 낙찰자 정보는 싣지 않는다 */
export default function AuctionResultsPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="Results" title="경매 결과 공시" description="미술진흥법 제15조에 따라 MAYO 경매에서 낙찰된 작품의 낙찰가와 대금 완납 여부를 공개합니다. 낙찰자 정보는 공개하지 않아요." />
      <Suspense fallback={<p className="text-ink-soft">불러오는 중…</p>}>
        <Results />
      </Suspense>
    </Container>
  );
}

async function Results() {
  await connection();
  await settleDueAuctions();
  const db = await store.read();
  const rows = db.auctions
    .filter((a) => a.state === "closed" && a.result?.kind === "sold")
    .sort((a, b) => (b.result!.at).localeCompare(a.result!.at));
  if (rows.length === 0) return <EmptyState title="아직 낙찰된 경매가 없어요" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="border-b border-ink text-left text-xs text-ink-soft">
          <tr><th className="py-2">마감일</th><th>작품</th><th>작가</th><th>방식</th><th className="text-right">낙찰가</th><th className="text-right">대금</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((a) => {
            const r = a.result as Extract<NonNullable<typeof a.result>, { kind: "sold" }>;
            const w = db.works.find((x) => x.id === a.workId);
            const artist = w && db.artists.find((x) => x.id === w.artistId);
            return (
              <tr key={a.id}>
                <td className="py-2.5 whitespace-nowrap">{formatDate(r.at)}</td>
                <td>{w ? <Link href={`/works/${w.id}`} className="underline-offset-4 hover:underline">「{w.title}」</Link> : "삭제된 작품"}</td>
                <td>{artist?.name}</td>
                <td>{VIA[r.via]}</td>
                <td className="text-right font-semibold tabular-nums">{formatPrice(r.hammer)}</td>
                <td className="text-right">{PAYMENT[r.payment]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
