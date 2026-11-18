import { connection } from "next/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cancelAuction, failAuctionPayment, rejectAuctionRequest, scheduleExhibition, setAuctionFee } from "@/features/admin/auction-actions";
import { CreateAuctionForm, ScheduleRequestForm } from "@/features/admin/auction-forms";
import { adminDb } from "@/features/admin/session";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { feeRate, requestNow, settleDueAuctions } from "@/features/auction/server";
import { auctionPhase, standing } from "@/lib/domain/auction";
import { isOrderable } from "@/lib/domain/rules";
import { formatDateTime, formatPrice } from "@/lib/format";

const PHASE = { requested: "신청", upcoming: "시작 전", live: "진행 중", ended: "마감", cancelled: "취소" } as const;
const PAYMENT = { pending: "입금 대기", paid: "완납", failed: "미납" } as const;

export default async function AdminAuctions() {
  await connection();
  await settleDueAuctions();
  const db = await adminDb();
  const now = requestNow();
  const work = (id: string) => db.works.find((w) => w.id === id);
  const artistName = (workId: string) => db.artists.find((a) => a.id === work(workId)?.artistId)?.name ?? "";
  const requested = db.auctions.filter((a) => a.state === "requested");
  const open = db.auctions.filter((a) => a.state === "scheduled").sort((a, b) => a.endsAt.localeCompare(b.endsAt));
  const closed = db.auctions.filter((a) => a.state === "closed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const candidates = db.works.filter(isOrderable).map((w) => ({ id: w.id, label: `「${w.title}」 ${db.artists.find((a) => a.id === w.artistId)?.name ?? ""}, 정가 ${formatPrice(w.price)}` }));
  const exhibitionIds = [...new Set(open.map((a) => a.exhibitionId ?? work(a.workId)?.exhibitionId).filter((x): x is string => Boolean(x)))];

  return (
    <>
      <AdminHeading
        title="경매"
        description={<>미술진흥법 제15조⑤: 낙찰가와 완납 여부는 <Link href="/auctions/results" className="underline">경매 결과</Link>에 자동으로 공시돼요. 운영자, 직원 계정(MAYO_STAFF_EMAILS)과 작가 본인은 입찰할 수 없어요. 운영자나 친족 소유 작품은 작품 편집에서 &lsquo;운영자 소유&rsquo;를 켜면 경매 화면에 사전 고지가 붙어요. 경매 시작 전에 미술품 경매업 신고를 마쳐야 해요.</>}
      />

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="font-bold">구매 수수료</h2>
        <form action={setAuctionFee} className="flex items-center gap-2 text-sm">
          <Input name="feePercent" inputMode="decimal" defaultValue={Math.round(feeRate(db) * 1000) / 10} className="w-24" aria-label="구매 수수료율 (%)" />%
          <Button type="submit" size="sm" variant="secondary">저장</Button>
          <span className="text-ink-soft">입찰 화면의 최대 결제 금액, 낙찰 주문에 바로 반영돼요. 이미 생긴 주문은 그대로예요.</span>
        </form>
      </section>

      {requested.length > 0 && (
        <section className="mb-10 flex flex-col gap-3">
          <h2 className="font-bold">작가 경매 신청 {requested.length}</h2>
          <ul className="flex flex-col gap-3">
            {requested.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warn">신청</Badge>
                  <b>「{work(a.workId)?.title}」</b> {artistName(a.workId)}
                  <form action={rejectAuctionRequest.bind(null, a.id)} className="ml-auto"><Button type="submit" size="sm" variant="danger">거절</Button></form>
                </div>
                <ScheduleRequestForm auctionId={a.id} terms={a} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="font-bold">새 경매</h2>
        <CreateAuctionForm works={candidates} />
      </section>

      {exhibitionIds.length > 0 && (
        <section className="mb-10 flex flex-col gap-3">
          <h2 className="font-bold">전시 일정으로 맞추기</h2>
          <p className="text-sm text-ink-soft">전시 첫날 10시에 열고, 마지막 날 정한 시각부터 작품마다 2분 간격으로 마감해요. 입찰이 들어온 경매는 바꾸지 않아요.</p>
          {exhibitionIds.map((id) => {
            const e = db.exhibitions.find((x) => x.id === id);
            if (!e) return null;
            return (
              <form key={id} action={scheduleExhibition.bind(null, id)} className="flex flex-wrap items-center gap-2 text-sm">
                <b>{e.title}</b> {e.startDate} ~ {e.endDate}, 첫 마감
                <Input name="first" type="time" defaultValue="18:00" className="w-32" />
                <Button type="submit" size="sm" variant="secondary">순차 마감 적용</Button>
              </form>
            );
          })}
        </section>
      )}

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="font-bold">열린 경매 {open.length}</h2>
        <Table head={["작품", "상태", "현재가", "입찰", "시작", "마감", ""]}>
          {open.map((a) => {
            const phase = auctionPhase(a, now);
            return (
              <tr key={a.id}>
                <Td><Link href={`/works/${a.workId}`} className="hover:underline">「{work(a.workId)?.title}」</Link> {artistName(a.workId)}</Td>
                <Td><Badge tone={phase === "live" ? "violet" : undefined}>{PHASE[phase]}</Badge></Td>
                <Td>{formatPrice(standing(a).price)}</Td>
                <Td>{a.bids.length}회, {a.maxes.length}명</Td>
                <Td>{formatDateTime(a.startsAt)}</Td>
                <Td>{formatDateTime(a.endsAt)}{a.endsAt !== a.originalEndsAt && " (연장)"}</Td>
                <Td>{a.bids.length === 0 && <form action={cancelAuction.bind(null, a.id)}><Button type="submit" size="sm" variant="danger">취소</Button></form>}</Td>
              </tr>
            );
          })}
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">마감 {closed.length}</h2>
        <Table head={["작품", "결과", "낙찰가", "대금", "주문", ""]}>
          {closed.map((a) => {
            const r = a.result;
            const order = r?.kind === "sold" ? db.orders.find((o) => o.id === r.orderId) : undefined;
            const bidder = r?.kind === "sold" ? db.users.find((u) => u.id === r.userId) : undefined;
            return (
              <tr key={a.id}>
                <Td>「{work(a.workId)?.title}」 {artistName(a.workId)}</Td>
                <Td>{r?.kind === "sold" ? `낙찰 (${bidder?.name ?? "탈퇴 회원"})` : "유찰"}{a.offer && ", 차순위 제안 중"}</Td>
                <Td>{r?.kind === "sold" ? formatPrice(r.hammer) : ""}</Td>
                <Td>{r?.kind === "sold" ? PAYMENT[r.payment] : ""}</Td>
                <Td>{order && <Link href={`/admin/orders/${order.id}`} className="font-mono underline">{order.code}</Link>}</Td>
                <Td>
                  {r?.kind === "sold" && r.payment === "pending" && (
                    <form action={failAuctionPayment.bind(null, a.id)}><Button type="submit" size="sm" variant="danger">미결제 처리, 차순위 제안</Button></form>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </section>
    </>
  );
}
