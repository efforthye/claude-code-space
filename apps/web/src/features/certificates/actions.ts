"use server";

import { refresh } from "next/cache";
import { store, STORE_READONLY } from "@/lib/data/store";
import { allow } from "@/lib/security/rate-limit";

/**
 * 구매자의 작품 보증서 요청. 주문번호를 아는 사람 = 주문 조회 화면을 연 사람이라 같은 기준으로 받는다.
 * 요청만 남기고, 발급은 운영자가 작품 정보를 확인한 뒤 관리자 화면에서 한다.
 */
export async function requestCertificate(orderCode: string, workId: string) {
  if (STORE_READONLY) return;
  if (!(await allow("certificate-request", 10, 10 * 60_000))) return;
  await store.update((db) => {
    const order = db.orders.find((o) => o.code === orderCode);
    if (!order?.paidAt || order.status === "cancelled") return;
    const item = order.items.find((i) => i.workId === workId);
    if (!item || item.certificateRequestedAt) return;
    item.certificateRequestedAt = new Date().toISOString();
    order.history.push({ at: item.certificateRequestedAt, status: order.status, note: `구매자 작품 보증서 요청「${item.title}」` });
  });
  refresh();
}
