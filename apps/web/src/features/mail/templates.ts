import "server-only";
import { getBankAccount } from "@/features/orders/payment";
import type { Order } from "@/lib/domain/types";
import { formatDateTime, formatPrice } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import type { Mail } from "./send";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** 단순한 메일 틀: 제목, 문단들, 버튼 하나. 사용자 입력은 모두 escape */
function layout(title: string, paragraphs: string[], button?: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.7">${esc(p).replaceAll("\n", "<br>")}</p>`).join("");
  const btn = button
    ? `<p style="margin:24px 0"><a href="${esc(button.href)}" style="display:inline-block;background:#1d1530;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#fbf8f4;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;color:#1d1530">
<div style="max-width:520px;margin:0 auto;padding:32px 24px"><p style="font-size:22px;font-weight:700;color:#4b2bb0;margin:0 0 24px">MAYO</p>
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}${btn}
<p style="margin:32px 0 0;font-size:12px;color:#6b6280">MAYO, ${esc(siteConfig.url.replace(/^https?:\/\//, ""))}. 이 메일은 발신 전용이에요. 궁금한 점은 사이트의 문의하기로 보내 주세요.</p></div></body></html>`;
  const text = [title, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.href}`] : [])].join("\n");
  return { html, text };
}

const total = (o: Order) => o.subtotal + o.parcelFee + (o.shippingQuote ?? 0);
const items = (o: Order) => o.items.map((i) => `「${i.title}」 ${i.artistName}, ${formatPrice(i.price)}`).join("\n");

export function orderPlaced(o: Order): Mail {
  const bank = getBankAccount();
  const pay = bank
    ? `입금 계좌: ${bank.bankName} ${bank.accountNumber} (${bank.accountHolder})\n입금 금액: ${formatPrice(total(o))}\n입금자명: ${o.depositorName}\n입금 기한: ${formatDateTime(o.paymentDueAt)}`
    : `입금 계좌는 따로 안내드릴게요. 입금 금액: ${formatPrice(total(o))}`;
  const { html, text } = layout(`주문이 접수됐어요 (${o.code})`, [`${o.buyer.name}님, 주문해 주셔서 고마워요. 작품은 입금 기한까지 예약돼 있어요.`, items(o), pay], {
    label: "주문 확인하기",
    href: `${siteConfig.url}/orders/${o.code}`,
  });
  return { to: o.buyer.email, subject: `[MAYO] 주문 접수 ${o.code}`, html, text };
}

export function paymentConfirmed(o: Order): Mail {
  const { html, text } = layout(`입금이 확인됐어요 (${o.code})`, [`${o.buyer.name}님, 입금을 확인했어요. 작가와 배송, 수령 일정을 맞춰 연락드릴게요.`, items(o)], {
    label: "주문 확인하기",
    href: `${siteConfig.url}/orders/${o.code}`,
  });
  return { to: o.buyer.email, subject: `[MAYO] 입금 확인 ${o.code}`, html, text };
}

export function orderShipped(o: Order, note: string): Mail {
  const { html, text } = layout(`작품을 보냈어요 (${o.code})`, [`${o.buyer.name}님, 주문하신 작품이 출발했어요.`, items(o), note ? `안내: ${note}` : ""].filter(Boolean), {
    label: "주문 확인하기",
    href: `${siteConfig.url}/orders/${o.code}`,
  });
  return { to: o.buyer.email, subject: `[MAYO] 발송 안내 ${o.code}`, html, text };
}

export function received(to: string, what: string, code: string): Mail {
  const { html, text } = layout(`${what}이 접수됐어요`, [`접수 번호는 ${code}예요. 진행 상황은 아래에서 이 번호로 볼 수 있어요.`], {
    label: "진행 상황 보기",
    href: `${siteConfig.url}/my`,
  });
  return { to, subject: `[MAYO] ${what} 접수 ${code}`, html, text };
}

export function adminNotice(to: string, title: string, lines: string[], path: string): Mail {
  const { html, text } = layout(title, lines, { label: "관리자에서 보기", href: `${siteConfig.url}${path}` });
  return { to, subject: `[MAYO 관리자] ${title}`, html, text };
}

export function inquiryAnswered(to: string, subject: string, answer: string): Mail {
  const { html, text } = layout(`문의에 답변드려요`, [`문의: ${subject}`, answer]);
  return { to, subject: `[MAYO] 문의 답변: ${subject}`, html, text };
}

export function passwordReset(to: string, link: string): Mail {
  const { html, text } = layout("비밀번호를 다시 정해 주세요", ["아래 버튼을 누르면 새 비밀번호를 정할 수 있어요. 링크는 30분 동안만 쓸 수 있어요.", "직접 요청하지 않았다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요."], {
    label: "새 비밀번호 정하기",
    href: link,
  });
  return { to, subject: "[MAYO] 비밀번호 재설정", html, text };
}

export function schoolEmailConfirm(to: string, schoolName: string, link: string): Mail {
  const { html, text } = layout("학교 이메일을 확인해 주세요", [`${schoolName} 학교 인증을 위해 이 주소가 본인 것인지 확인하려고 해요.`, "아래 버튼을 누르면 확인이 끝나요. 링크는 3일 동안 쓸 수 있어요."], {
    label: "학교 이메일 확인",
    href: link,
  });
  return { to, subject: "[MAYO] 학교 이메일 확인", html, text };
}
