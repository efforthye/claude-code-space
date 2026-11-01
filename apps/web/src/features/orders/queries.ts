import "server-only";
import { store } from "@/lib/data/store";

/** 주문은 캐시하지 않는다 — 입금 확인 직후 상태가 바로 보여야 한다. */
export async function findOrderByCode(code: string) {
  const db = await store.read();
  return db.orders.find((o) => o.code === code.trim().toUpperCase()) ?? null;
}
