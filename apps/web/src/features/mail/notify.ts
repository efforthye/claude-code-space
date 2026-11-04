import "server-only";
import { after } from "next/server";
import { store } from "@/lib/data/store";
import { formatPrice } from "@/lib/format";
import { adminAddress, sendMail } from "./send";
import * as T from "./templates";

/**
 * 흐름별 메일. 모두 응답을 보낸 뒤(after) 보내서, 메일이 늦거나 실패해도 주문, 신청은 그대로 끝난다.
 */
export function notifyOrderPlaced(code: string) {
  after(async () => {
    const o = (await store.read()).orders.find((x) => x.code === code);
    if (!o) return;
    await sendMail(T.orderPlaced(o));
    const admin = adminAddress();
    if (admin) await sendMail(T.adminNotice(admin, `새 주문 ${o.code}`, [`${o.buyer.name}, ${formatPrice(o.subtotal)}`, o.items.map((i) => `「${i.title}」 ${i.artistName}`).join("\n")], `/admin/orders/${o.id}`));
  });
}

export function notifyOrderStatus(orderId: string, status: string, note: string) {
  if (status !== "paid" && status !== "shipped") return;
  after(async () => {
    const o = (await store.read()).orders.find((x) => x.id === orderId);
    if (!o) return;
    await sendMail(status === "paid" ? T.paymentConfirmed(o) : T.orderShipped(o, note));
  });
}

export function notifyReceived(to: string, what: string, code: string, adminPath: string, adminLines: string[]) {
  after(async () => {
    await sendMail(T.received(to, what, code));
    const admin = adminAddress();
    if (admin) await sendMail(T.adminNotice(admin, `새 ${what} ${code}`, adminLines, adminPath));
  });
}

export function notifyInquiryAnswered(inquiryId: string) {
  after(async () => {
    const q = (await store.read()).inquiries.find((x) => x.id === inquiryId);
    if (q?.answer) await sendMail(T.inquiryAnswered(q.email, q.subject, q.answer));
  });
}
