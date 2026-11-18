import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { changeRentalState, updateRentalMemo } from "@/features/admin/rental-actions";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { RENTAL_NEXT, RENTAL_STATE_LABEL } from "@/lib/domain/rules";
import { formatDateTime, formatPrice } from "@/lib/format";

const OPEN = new Set(["requested", "confirmed", "active"]);

export default async function AdminRentals() {
  const db = await adminDb();
  const rows = [...db.rentals].sort((a, b) => Number(OPEN.has(b.state)) - Number(OPEN.has(a.state)) || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <AdminHeading
        title="렌탈"
        description="확정하면 작품이 예약으로 묶여 장바구니, 경매에서 빠져요. 반납이나 취소하면 다시 판매 중으로 돌아가요. 구매 전환은 낸 렌탈료 절반을 뺀 입금 대기 주문을 만들어요. 미술품 대여업은 미술서비스업 신고 대상이에요."
      />
      {rows.length === 0 && <p className="text-sm text-ink-soft">아직 렌탈 신청이 없어요.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.state === "requested" ? "warn" : r.state === "active" ? "violet" : undefined}>{RENTAL_STATE_LABEL[r.state]}</Badge>
              <Badge>{r.audience === "business" ? "기업" : "개인"}</Badge>
              <b className="text-base">{r.company ? `${r.company}, ` : ""}{r.name}</b>
              <span className="ml-auto font-mono text-xs text-ink-soft">{r.code}, {formatDateTime(r.createdAt)}</span>
            </div>
            <p className="text-ink-soft">
              {r.email}, {r.phone}{r.bizNumber && `, 사업자 ${r.bizNumber}`}
              <br />
              {r.address}
            </p>
            <ul className="flex flex-wrap gap-2">
              {r.workIds.map((id) => {
                const w = db.works.find((x) => x.id === id);
                return <li key={id}><Link href={`/works/${id}`} className="rounded-full bg-mist px-3 py-1 hover:underline">「{w?.title ?? "삭제된 작품"}」</Link></li>;
              })}
            </ul>
            <p>
              {r.months}개월, {r.startDate} 시작 희망. 월 {formatPrice(r.monthlyTotal)}, 보증금 {formatPrice(r.deposit)}
            </p>
            {r.spaceNote && <p className="rounded-sm bg-mist p-3 whitespace-pre-line">{r.spaceNote}</p>}
            <form action={updateRentalMemo.bind(null, r.id)} className="flex flex-col gap-2">
              <Textarea name="adminMemo" defaultValue={r.adminMemo} placeholder="운영 메모 (설치일, 운송 견적, 작가와 협의한 내용)" className="min-h-16" />
              <Button type="submit" size="sm" variant="secondary" className="self-end">메모 저장</Button>
            </form>
            {RENTAL_NEXT[r.state].length > 0 && (
              <div className="flex flex-wrap gap-2">
                {RENTAL_NEXT[r.state].map((next) => (
                  <form key={next} action={changeRentalState.bind(null, r.id, next)} className="flex items-center gap-2">
                    <Input name="note" placeholder="고객에게 보일 메모" className="h-8 w-44" />
                    {next === "purchased" && <Input name="paidMonths" inputMode="numeric" placeholder="낸 개월 수" className="h-8 w-24" />}
                    <Button type="submit" size="sm" variant={next === "cancelled" ? "danger" : "primary"}>{RENTAL_STATE_LABEL[next]}</Button>
                  </form>
                ))}
              </div>
            )}
            <ol className="text-xs text-ink-soft">
              {r.history.map((h, i) => <li key={i}>{formatDateTime(h.at)} {RENTAL_STATE_LABEL[h.state]}{h.note && h.note !== RENTAL_STATE_LABEL[h.state] ? `: ${h.note}` : ""}</li>)}
            </ol>
          </li>
        ))}
      </ul>
    </>
  );
}
