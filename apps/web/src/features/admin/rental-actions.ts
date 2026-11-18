"use server";

import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/data/catalog";
import { store } from "@/lib/data/store";
import { artShippingIds, isRentable, PAYMENT_DUE_HOURS, rentalMonthly, RENT_TO_OWN_CREDIT, RENTAL_NEXT, RENTAL_STATE_LABEL, shippingOptions } from "@/lib/domain/rules";
import type { Order, RentalState } from "@/lib/domain/types";
import { newId, newOrderCode } from "@/lib/ids";
import { notifyConsultAnswered } from "@/features/mail/notify";
import { requireAdmin } from "./session";

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

function done() {
  updateTag(TAG.catalog);
  refresh();
}

export async function changeRentalState(rentalId: string, next: RentalState, form: FormData) {
  await requireAdmin();
  const note = s(form, "note");
  const paidMonths = Math.max(0, Math.min(36, Number(s(form, "paidMonths")) || 0));
  const error = await store.update((db) => {
    const r = db.rentals.find((x) => x.id === rentalId);
    if (!r || !RENTAL_NEXT[r.state].includes(next)) return "바꿀 수 없는 상태예요";
    const works = r.workIds.map((id) => db.works.find((w) => w.id === id)).filter((w) => w !== undefined);
    const now = new Date().toISOString();

    if (next === "confirmed") {
      const busy = works.filter((w) => !isRentable(w));
      if (busy.length > 0) return `이미 예약, 판매, 경매 중인 작품이 있어요: ${busy.map((w) => w.title).join(", ")}`;
      for (const w of works) {
        w.status = "reserved";
        w.updatedAt = now;
      }
    }
    if (next === "returned" || next === "cancelled") {
      for (const w of works) {
        if (w.status === "reserved") w.status = "available";
        w.updatedAt = now;
      }
    }
    if (next === "purchased") {
      // 렌탈하다 사기: 낸 렌탈료의 절반을 작품가에서 빼고 입금 대기 주문을 만든다
      const cats = artShippingIds(db.categories);
      const items = works.map((w) => ({
        workId: w.id,
        title: w.title,
        artistName: db.artists.find((a) => a.id === w.artistId)?.name ?? "",
        edition: w.edition,
        price: Math.max(0, w.price - Math.round(rentalMonthly(w.price) * paidMonths * RENT_TO_OWN_CREDIT)),
        shipping: shippingOptions(w, cats).includes("pickup") ? ("pickup" as const) : shippingOptions(w, cats)[0],
        seller: w.consignor,
        certificateRequestedAt: null,
      }));
      const order: Order = {
        id: newId("ord"),
        userId: r.userId ?? null,
        code: newOrderCode(),
        items,
        buyer: { name: r.company ? `${r.company} ${r.name}` : r.name, phone: r.phone, email: r.email, address: r.address, deliveryNote: "렌탈 중인 작품을 그대로 구매 (운송 없음)" },
        depositorName: r.company ?? r.name,
        subtotal: items.reduce((sum, i) => sum + i.price, 0),
        parcelFee: 0,
        shippingQuote: null,
        status: "pending_payment",
        paymentMethod: "bank_transfer",
        paymentDueAt: new Date(Date.now() + PAYMENT_DUE_HOURS * 3600_000).toISOString(),
        paidAt: null,
        adminMemo: `렌탈 ${r.code}에서 구매 전환, 렌탈료 ${paidMonths}개월분의 ${Math.round(RENT_TO_OWN_CREDIT * 100)}% 차감`,
        history: [{ at: now, status: "pending_payment", note: `렌탈 ${r.code} 구매 전환` }],
        createdAt: now,
      };
      db.orders.push(order);
    }
    r.state = next;
    r.history.push({ at: now, state: next, note: note || RENTAL_STATE_LABEL[next] });
    return null;
  });
  if (error) throw new Error(error);
  done();
}

export async function updateRentalMemo(rentalId: string, form: FormData) {
  await requireAdmin();
  await store.update((db) => {
    const r = db.rentals.find((x) => x.id === rentalId);
    if (r) r.adminMemo = s(form, "adminMemo").slice(0, 2000);
  });
  refresh();
}

/** 상담에 제안을 적는다. 신청한 사람이 마이페이지에서 보고, 메일로도 간다 */
export async function answerConsultation(id: string, form: FormData) {
  await requireAdmin();
  const answer = s(form, "answer").slice(0, 4000);
  const state = s(form, "state");
  const mail = await store.update((db) => {
    const c = db.consultations.find((x) => x.id === id);
    if (!c) return null;
    const first = answer && answer !== c.answer;
    c.answer = answer || c.answer;
    if (state === "proposed" || state === "contracted" || state === "closed" || state === "new") c.state = state;
    else if (first && c.state === "new") c.state = "proposed";
    return first ? { email: c.email, subject: `${c.company ?? c.name} 상담 (${c.code})`, answer } : null;
  });
  if (mail) notifyConsultAnswered(mail.email, mail.subject, mail.answer);
  refresh();
}
