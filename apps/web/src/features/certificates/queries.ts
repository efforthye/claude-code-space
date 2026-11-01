import "server-only";
import { store } from "@/lib/data/store";

/** 보증서는 캐시하지 않는다, 취소되면 확인 화면에 바로 보여야 한다. */
export async function findCertificate(code: string) {
  const db = await store.read();
  return db.certificates.find((c) => c.code === code.trim().toUpperCase()) ?? null;
}

export async function certificatesForOrder(orderId: string) {
  const db = await store.read();
  return db.certificates.filter((c) => c.orderId === orderId);
}
