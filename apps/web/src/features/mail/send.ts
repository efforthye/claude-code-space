import "server-only";

/**
 * 메일 발송 (Resend). RESEND_API_KEY가 없으면 보내지 않고(개발에선 로그만) 넘어간다.
 * 발송 실패가 주문이나 신청을 막으면 안 되므로, 부르는 쪽은 next/server의 after()로 응답 뒤에 보낸다.
 * 보내는 주소는 MAIL_FROM (Resend에서 mayo.im 도메인 인증 필요).
 */
export const MAIL_ENABLED = Boolean(process.env.RESEND_API_KEY);

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };

export async function sendMail(mail: Mail) {
  // 테스트 전용: 보낸 메일을 파일에 남겨 링크를 따라가 볼 수 있게 (실서비스에는 이 변수가 없다)
  if (process.env.MAYO_MAIL_OUTBOX && !process.env.VERCEL) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.MAYO_MAIL_OUTBOX, JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text }) + "\n");
    return true;
  }
  if (!MAIL_ENABLED) {
    if (process.env.NODE_ENV !== "production") console.info(`[mail skipped: no RESEND_API_KEY] to=${mail.to} subject=${mail.subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "MAYO <no-reply@mayo.im>",
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[mail] ${res.status} for ${mail.subject}`);
    return res.ok;
  } catch (e) {
    console.error("[mail] failed", (e as Error).message);
    return false;
  }
}

/** 운영자에게 알림 (ADMIN_NOTIFY_EMAIL, 없으면 BUSINESS_EMAIL) */
export function adminAddress() {
  return process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_EMAIL ?? null;
}
