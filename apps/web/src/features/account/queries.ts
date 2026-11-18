import "server-only";
import { store } from "@/lib/data/store";
import { CONSULT_KIND_LABEL, CONSULT_STATE_LABEL, ORDER_STATUS_LABEL, orderTotal, RENTAL_STATE_LABEL } from "@/lib/domain/rules";
import { formatPrice } from "@/lib/format";

export type MyRow = {
  code: string;
  title: string;
  state: string;
  tone: "warn" | "ok" | "neutral";
  createdAt: string;
  href: string | null;
  detail: string | null;
};

/** 마이페이지 데이터. 이 회원에게 연결된 것만, 다른 사람 개인정보는 담지 않는다. */
export async function myAccountData(userId: string) {
  const db = await store.read();
  const orders = db.orders
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({
      code: o.code,
      createdAt: o.createdAt,
      status: o.status,
      statusLabel: ORDER_STATUS_LABEL[o.status],
      total: orderTotal(o),
      items: o.items.map((i) => ({
        workId: i.workId,
        title: i.title,
        artistName: i.artistName,
        cover: db.works.find((w) => w.id === i.workId)?.media.find((m) => m.kind === "image")?.src ?? null,
        certificate: db.certificates.find((c) => c.orderId === o.id && c.workId === i.workId && !c.revokedAt)?.code ?? null,
      })),
    }));

  const requests: MyRow[] = [
    ...db.applications.filter((a) => a.userId === userId).map((a): MyRow => ({
      code: a.code, title: `작가 입점 신청: ${a.name}`, createdAt: a.createdAt,
      state: a.state === "new" ? "검토 대기 중" : a.state === "approved" ? "승인됨" : "보류",
      tone: a.state === "new" ? "warn" : a.state === "approved" ? "ok" : "neutral",
      href: a.artistId ? `/artists/${a.artistId}` : null, detail: null,
    })),
    ...db.exhibitionRequests.filter((r) => r.userId === userId).map((r): MyRow => ({
      code: r.code, title: `전시 등록 신청: ${r.title}`, createdAt: r.createdAt,
      state: r.state === "new" ? "검토 대기 중" : r.state === "approved" ? "등록됨" : "보류",
      tone: r.state === "new" ? "warn" : r.state === "approved" ? "ok" : "neutral",
      href: r.exhibitionId ? `/exhibitions/${r.exhibitionId}` : null, detail: null,
    })),
    ...db.inquiries.filter((q) => q.userId === userId).map((q): MyRow => ({
      code: q.code, title: `문의: ${q.subject}`, createdAt: q.createdAt,
      state: q.state === "new" ? "답변 준비 중" : q.state === "answered" ? "답변 완료" : "닫힘",
      tone: q.state === "new" ? "warn" : q.state === "answered" ? "ok" : "neutral",
      href: null, detail: q.answer,
    })),
    ...db.rentals.filter((r) => r.userId === userId).map((r): MyRow => ({
      code: r.code,
      title: `렌탈: ${r.workIds.map((id) => `「${db.works.find((w) => w.id === id)?.title ?? "삭제된 작품"}」`).join(", ")}`,
      createdAt: r.createdAt,
      state: RENTAL_STATE_LABEL[r.state],
      tone: r.state === "requested" ? "warn" : r.state === "cancelled" ? "neutral" : "ok",
      href: null,
      detail: `${r.months}개월, 월 ${formatPrice(r.monthlyTotal)}, 보증금 ${formatPrice(r.deposit)}${r.history.length > 1 ? `\n${r.history[r.history.length - 1].note}` : ""}`,
    })),
    ...db.consultations.filter((c) => c.userId === userId).map((c): MyRow => ({
      code: c.code, title: `${c.audience === "business" ? "기업 상담" : "작품 추천"}: ${CONSULT_KIND_LABEL[c.kind]}`, createdAt: c.createdAt,
      state: CONSULT_STATE_LABEL[c.state],
      tone: c.state === "new" ? "warn" : c.state === "closed" ? "neutral" : "ok",
      href: null, detail: c.answer,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { orders, requests };
}
