import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { isPaymentOverdue, ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import type { OrderStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPrice } from "@/lib/format";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export default async function AdminOrders(props: PageProps<"/admin/orders">) {
  const sp = await props.searchParams;
  const filter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const db = await adminDb();
  const orders = [...db.orders]
    .filter((o) => !filter || o.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <AdminHeading title="주문과 입금 확인" description="통장 입금 내역과 입금자명, 금액을 맞춰 보고 ‘입금 확인’을 눌러 주세요. 확인하면 작품이 판매 완료로 바뀝니다." />
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <Link href="/admin/orders" className={cn("rounded-sm border px-3 py-1", !filter ? "border-ink bg-ink text-paper" : "border-line bg-paper")}>전체</Link>
        {STATUSES.map((st) => (
          <Link key={st} href={`/admin/orders?status=${st}`} className={cn("rounded-sm border px-3 py-1", filter === st ? "border-ink bg-ink text-paper" : "border-line bg-paper")}>
            {ORDER_STATUS_LABEL[st]} {db.orders.filter((o) => o.status === st).length}
          </Link>
        ))}
      </div>
      <Table head={["주문번호", "상태", "입금자명", "작품", "입금할 금액", "입금 기한", "신청일"]}>
        {orders.map((o) => {
          const late = isPaymentOverdue(o);
          const awaitingQuote = o.items.some((i) => i.shipping === "art_shipping") && o.shippingQuote == null && o.status !== "cancelled";
          return (
            <tr key={o.id} className="hover:bg-mist/50">
              <Td><Link href={`/admin/orders/${o.id}`} className="font-semibold underline underline-offset-2">{o.code}</Link></Td>
              <Td>
                <div className="flex flex-col gap-1">
                  <Badge tone={o.status === "pending_payment" ? "warn" : o.status === "cancelled" ? "neutral" : "ok"} className="w-fit">{ORDER_STATUS_LABEL[o.status]}</Badge>
                  {late && <Badge tone="dot" className="w-fit">기한 지남</Badge>}
                  {awaitingQuote && <Badge tone="clay" className="w-fit">운송 견적 필요</Badge>}
                </div>
              </Td>
              <Td>{o.depositorName}</Td>
              <Td>{o.items.map((i) => i.title).join(", ")}</Td>
              <Td className="font-semibold">{formatPrice(o.subtotal + o.parcelFee + (o.shippingQuote ?? 0))}</Td>
              <Td className={late ? "text-dot" : ""}>{formatDateTime(o.paymentDueAt)}</Td>
              <Td className="text-ink-soft">{formatDateTime(o.createdAt)}</Td>
            </tr>
          );
        })}
        {orders.length === 0 && <tr><Td className="py-8 text-center text-ink-soft">주문이 없어요.</Td></tr>}
      </Table>
    </>
  );
}
