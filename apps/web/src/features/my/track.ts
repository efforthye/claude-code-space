"use server";

import { store } from "@/lib/data/store";
import { allow } from "@/lib/security/rate-limit";
import { ORDER_STATUS_LABEL } from "@/lib/domain/rules";

export type TrackedStatus = {
  code: string;
  kind: "order" | "artist" | "exhibition" | "inquiry";
  title: string;
  state: string; // 화면 표시용
  tone: "warn" | "ok" | "neutral" | "dot";
  createdAt: string;
  detail: string | null; // 문의 답변 등
  href: string | null;
};

const CODE = /^(MAYO|J|E|Q)-[2-9A-HJ-NP-Z]{8}$/;

/** 번호로 진행 상황을 돌려준다. 개인정보(연락처, 주소)는 담지 않는다. */
export async function lookupStatuses(codes: string[]): Promise<TrackedStatus[]> {
  const wanted = [...new Set(codes.map((c) => c.trim().toUpperCase()))].filter((c) => CODE.test(c)).slice(0, 50);
  if (wanted.length === 0) return [];
  // 번호 대입으로 남의 신청을 찾는 시도를 늦춘다
  if (!(await allow("track", 60, 60_000))) return [];
  const db = await store.read();
  const out: TrackedStatus[] = [];
  for (const code of wanted) {
    const order = db.orders.find((o) => o.code === code);
    if (order) {
      out.push({
        code, kind: "order",
        title: `주문: ${order.items.map((i) => `「${i.title}」`).join(", ")}`,
        state: ORDER_STATUS_LABEL[order.status],
        tone: order.status === "pending_payment" ? "warn" : order.status === "cancelled" ? "neutral" : "ok",
        createdAt: order.createdAt, detail: null, href: `/orders/${order.code}`,
      });
      continue;
    }
    const app = db.applications.find((a) => a.code === code);
    if (app) {
      out.push({
        code, kind: "artist", title: `작가 입점 신청: ${app.name}`,
        state: app.state === "new" ? "검토 대기 중" : app.state === "approved" ? "승인됨" : "보류",
        tone: app.state === "new" ? "warn" : app.state === "approved" ? "ok" : "neutral",
        createdAt: app.createdAt,
        detail: app.state === "approved" ? "작가 페이지가 만들어졌어요. 촬영, 학교 인증 일정은 연락처로 안내드려요." : null,
        href: app.artistId ? `/artists/${app.artistId}` : null,
      });
      continue;
    }
    const req = db.exhibitionRequests.find((r) => r.code === code);
    if (req) {
      out.push({
        code, kind: "exhibition", title: `전시 등록 신청: ${req.title}`,
        state: req.state === "new" ? "검토 대기 중" : req.state === "approved" ? "등록됨" : "보류",
        tone: req.state === "new" ? "warn" : req.state === "approved" ? "ok" : "neutral",
        createdAt: req.createdAt,
        detail: req.state === "approved" ? "전시 페이지가 열렸어요." : null,
        href: req.exhibitionId ? `/exhibitions/${req.exhibitionId}` : null,
      });
      continue;
    }
    const q = db.inquiries.find((i) => i.code === code);
    if (q) {
      out.push({
        code, kind: "inquiry", title: `문의: ${q.subject}`,
        state: q.state === "new" ? "답변 대기 중" : q.state === "answered" ? "답변 완료" : "종료",
        tone: q.state === "new" ? "warn" : "ok",
        createdAt: q.createdAt, detail: q.answer, href: null,
      });
    }
  }
  return out;
}
