import "server-only";
import { coverImage } from "@/lib/domain/rules";
import type { Database } from "@/lib/domain/types";

/**
 * 미술품 유통 내역 (미술진흥법): 거래 일시, 작품명(에디션), 금액, 판매자, 작가, 작품 사진, 유형.
 * 입금이 확인된 주문만 거래로 본다. 취소된 주문은 기록에서 빼지 않고 상태로 남긴다.
 */
export type LedgerRow = {
  paidAt: string;
  orderCode: string;
  title: string;
  edition: string;
  price: number;
  seller: string;
  artist: string;
  image: string;
  type: string;
  orderStatus: string;
  certificate: string; // 발급한 보증서 코드 (없으면 빈칸)
};

export function buildLedger(db: Database): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const o of db.orders) {
    if (!o.paidAt) continue;
    for (const i of o.items) {
      const work = db.works.find((w) => w.id === i.workId);
      rows.push({
        paidAt: o.paidAt,
        orderCode: o.code,
        title: i.title,
        edition: i.edition ?? "",
        price: i.price,
        seller: i.seller ?? i.artistName, // 판매자 표시가 없으면 작가 본인 (1차 거래)
        artist: i.artistName,
        image: (work && coverImage(work)) ?? "",
        type: i.seller ? "2차 판매 (위탁)" : "1차 판매",
        orderStatus: o.status,
        certificate: db.certificates.find((c) => c.orderId === o.id && c.workId === i.workId && !c.revokedAt)?.code ?? "",
      });
    }
  }
  return rows.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}
