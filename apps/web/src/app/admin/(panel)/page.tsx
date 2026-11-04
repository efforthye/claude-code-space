import Link from "next/link";
import { AdminHeading, Stat } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { isPaymentOverdue, ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { getBusinessInfo } from "@/lib/site";

export default async function AdminDashboard() {
  const db = await adminDb();
  const pending = db.orders.filter((o) => o.status === "pending_payment");
  const overdue = pending.filter(isPaymentOverdue);
  const toShip = db.orders.filter((o) => o.status === "paid" || o.status === "preparing");
  const quoteNeeded = db.orders.filter(
    (o) => o.status !== "cancelled" && o.items.some((i) => i.shipping === "art_shipping") && o.shippingQuote == null,
  );
  // 월 경계는 한국 시간 기준
  const month = formatDate(new Date().toISOString()).slice(0, 7);
  const monthSales = db.orders
    .filter((o) => o.paidAt && formatDate(o.paidAt).slice(0, 7) === month && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.subtotal, 0);
  const recent = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <>
      <AdminHeading title="대시보드" description="오늘 처리할 일부터 위에 모았어요." />
      {getBusinessInfo().artServiceNumber === "등록 예정" && (
        <Link href="/admin/compliance" className="glass mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl p-5 transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-violet">사업자 할 일</span>
            <span className="font-bold">미술서비스업 신고가 아직이에요. 2027.7.25까지 강남구보건소 5층 문화도시과</span>
          </div>
          <span className="text-sm font-semibold text-violet">체크리스트 보기 →</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="입금 대기" value={pending.length} href="/admin/orders?status=pending_payment" tone={pending.length ? "warn" : undefined} />
        <Stat label="입금 기한 지남" value={overdue.length} href="/admin/orders?status=pending_payment" tone={overdue.length ? "dot" : undefined} />
        <Stat label="배송 준비할 주문" value={toShip.length} href="/admin/orders?status=paid" />
        <Stat label="운송 견적 필요" value={quoteNeeded.length} href="/admin/orders" tone={quoteNeeded.length ? "warn" : undefined} />
        <Stat label="새 입점 신청" value={db.applications.filter((a) => a.state === "new").length} href="/admin/applications" />
        <Stat label="새 전시 등록 신청" value={db.exhibitionRequests.filter((r) => r.state === "new").length} href="/admin/exhibition-requests" />
        <Stat label="답변 대기 문의" value={db.inquiries.filter((q) => q.state === "new").length} href="/admin/inquiries" tone={db.inquiries.some((q) => q.state === "new") ? "warn" : undefined} />
        <Stat
          label="보증서 요청"
          value={db.orders.flatMap((o) => o.items.filter((i) => i.certificateRequestedAt && !db.certificates.some((c) => c.orderId === o.id && c.workId === i.workId && !c.revokedAt))).length}
          href="/admin/orders"
        />
        <Stat label="작품 검수 대기" value={db.works.filter((w) => w.pendingReview).length} href="/admin/works" tone={db.works.some((w) => w.pendingReview) ? "warn" : undefined} />
        <Stat label="학교 인증 대기" value={db.verifications.filter((v) => v.state === "new").length} href="/admin/verifications" tone={db.verifications.some((v) => v.state === "new") ? "warn" : undefined} />
        <Stat label="판매 중 작품" value={db.works.filter((w) => w.status === "available").length} href="/admin/works" />
        <Stat label="미인증 작가" value={db.artists.filter((a) => !a.verifiedBy).length} href="/admin/artists" />
        <Stat label="이번 달 거래액(입금 확인)" value={formatPrice(monthSales)} href="/admin/ledger" />
      </div>
      <h2 className="mt-10 mb-3 font-bold">최근 주문</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-ink-soft">아직 주문이 없어요.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-paper text-sm">
          {recent.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap justify-between gap-2 px-4 py-3 hover:bg-mist">
                <span><b>{o.code}</b>, {o.buyer.name}, {o.items.map((i) => `「${i.title}」`).join(", ")}</span>
                <span className="text-ink-soft">{ORDER_STATUS_LABEL[o.status]}, {formatDateTime(o.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
