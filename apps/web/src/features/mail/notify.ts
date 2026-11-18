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

/** 경매 알림. 받을 회원 id로 주소를 찾는다 (회원이 지웠으면 보내지 않는다) */
export function notifyAuction(userId: string, workId: string, kind: "outbid" | "won" | "offer" | "buy_now", amount: number) {
  after(async () => {
    const db = await store.read();
    const user = db.users.find((u) => u.id === userId);
    const work = db.works.find((w) => w.id === workId);
    if (!user || !work) return;
    const title = `「${work.title}」`;
    const mail = {
      outbid: () => T.auctionNotice(user.email, `더 높은 입찰 ${title}`, "더 높은 입찰이 들어왔어요", [`${title} 현재가가 ${formatPrice(amount)}이 됐어요.`, "다시 입찰하려면 작품 화면에서 최대 금액을 올려 주세요. 마지막 1분 안에 입찰이 들어오면 마감이 90초 늘어나요."], { label: "다시 입찰하기", path: `/works/${work.id}` }),
      won: () => T.auctionNotice(user.email, `낙찰 ${title}`, "낙찰됐어요", [`${title}을(를) ${formatPrice(amount)}에 낙찰받으셨어요.`, "48시간 안에 받는 곳과 입금자명을 확인하고 입금해 주세요. 기한 안에 입금하지 않으면 낙찰이 취소되고 다음 입찰자에게 기회가 넘어가요."], { label: "결제 정보 확인", path: "/account/bids" }),
      buy_now: () => T.auctionNotice(user.email, `즉시구매 ${title}`, "즉시구매로 경매가 끝났어요", [`${title}을(를) ${formatPrice(amount)}에 사셨어요.`, "48시간 안에 받는 곳과 입금자명을 확인하고 입금해 주세요."], { label: "결제 정보 확인", path: "/account/bids" }),
      offer: () => T.auctionNotice(user.email, `구매 기회 ${title}`, "다시 구매할 기회가 왔어요", [`${title} 낙찰자가 결제하지 않아, 입찰하신 최대 금액 ${formatPrice(amount)}으로 구매하실 수 있어요.`, "24시간 안에 구매하거나 거절해 주세요."], { label: "구매 제안 보기", path: "/account/bids" }),
    }[kind]();
    await sendMail(mail);
  });
}

/** 기업, 추천 상담에 운영자가 제안을 적었을 때 */
export function notifyConsultAnswered(to: string, subject: string, answer: string) {
  after(async () => {
    await sendMail(T.inquiryAnswered(to, subject, answer));
  });
}
