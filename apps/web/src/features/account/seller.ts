import "server-only";
import { store } from "@/lib/data/store";
import { coverImage } from "@/lib/domain/rules";
import type { OrderStatus } from "@/lib/domain/types";

/** 판매 수수료. 이번 시즌은 0% (입점 페이지 안내와 같다). */
export const COMMISSION_RATE = 0;

/** 입금이 확인된 뒤에만 배송에 필요한 구매자 정보를 작가에게 보여 준다. */
const SHIP_INFO_STATUSES: OrderStatus[] = ["paid", "preparing", "shipped"];

/** 이 회원과 연결된 작가 페이지 (없으면 null) */
export async function myArtist(userId: string) {
  const db = await store.read();
  return db.artists.find((a) => a.userId === userId) ?? null;
}

/** 판매자 화면 데이터: 내 작품, 내 작품이 들어간 주문, 정산 합계 */
export async function sellerData(artistId: string) {
  const db = await store.read();
  const works = db.works
    .filter((w) => w.artistId === artistId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((w) => ({ id: w.id, title: w.title, status: w.status, price: w.price, cover: coverImage(w) ?? null, pendingReview: !!w.pendingReview, updatedAt: w.updatedAt }));
  const mine = new Set(works.map((w) => w.id));

  const sales = db.orders
    .flatMap((o) =>
      o.items
        .filter((i) => mine.has(i.workId))
        .map((i) => {
          const ship = SHIP_INFO_STATUSES.includes(o.status);
          return {
            orderCode: o.code,
            workId: i.workId,
            title: i.title,
            price: i.price,
            payout: Math.round(i.price * (1 - COMMISSION_RATE)),
            shipping: i.shipping,
            status: o.status,
            createdAt: o.createdAt,
            paidAt: o.paidAt,
            settledAt: i.settledAt ?? null,
            // 배송 정보는 입금 확인 뒤, 발송 전까지만
            buyer: ship ? { name: o.buyer.name, phone: o.buyer.phone, address: o.buyer.address, note: o.buyer.deliveryNote } : null,
          };
        }),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const settled = sales.filter((s) => s.settledAt).reduce((n, s) => n + s.payout, 0);
  const due = sales.filter((s) => s.paidAt && !s.settledAt && s.status !== "cancelled").reduce((n, s) => n + s.payout, 0);
  return {
    works,
    sales,
    stats: {
      available: works.filter((w) => w.status === "available").length,
      reserved: works.filter((w) => w.status === "reserved").length,
      sold: works.filter((w) => w.status === "sold").length,
      pending: works.filter((w) => w.pendingReview).length,
      due,
      settled,
    },
  };
}

/** 작가 본인 작품 한 점 (수정 화면용). 다른 작가 작품이면 null */
export async function myWork(artistId: string, workId: string) {
  const db = await store.read();
  return db.works.find((w) => w.id === workId && w.artistId === artistId) ?? null;
}

/** 이 회원의 가장 최근 학교 인증 요청 */
export async function myVerification(userId: string) {
  const db = await store.read();
  return [...db.verifications].filter((v) => v.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}
