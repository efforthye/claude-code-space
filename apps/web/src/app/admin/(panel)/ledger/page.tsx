import { buttonClass } from "@/components/ui/button";
import { buildLedger } from "@/features/admin/ledger";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import type { OrderStatus } from "@/lib/domain/types";
import { formatDateTime, formatPrice } from "@/lib/format";

export default async function AdminLedger() {
  const rows = buildLedger(await adminDb());
  return (
    <>
      <AdminHeading
        title="미술품 유통 내역"
        description="입금이 확인된 거래를 미술진흥법 유통 내역 항목대로 모았어요. 매달 CSV를 세무사에게 보내 주세요."
        action={<a href="/admin/ledger.csv" className={buttonClass("secondary")}>CSV 내려받기</a>}
      />
      <Table head={["거래 일시", "주문번호", "작품명", "에디션", "금액", "판매자", "작가", "유형", "현재 상태"]}>
        {rows.map((r, i) => (
          <tr key={r.orderCode + i}>
            <Td>{formatDateTime(r.paidAt)}</Td>
            <Td>{r.orderCode}</Td>
            <Td className="font-semibold">{r.title}</Td>
            <Td>{r.edition || "—"}</Td>
            <Td>{formatPrice(r.price)}</Td>
            <Td>{r.seller}</Td>
            <Td>{r.artist}</Td>
            <Td>{r.type}</Td>
            <Td>{ORDER_STATUS_LABEL[r.orderStatus as OrderStatus]}</Td>
          </tr>
        ))}
        {rows.length === 0 && <tr><Td className="py-8 text-ink-soft">입금 확인된 거래가 아직 없어요.</Td></tr>}
      </Table>
    </>
  );
}
