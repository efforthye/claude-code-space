const won = new Intl.NumberFormat("ko-KR");

export function formatPrice(value: number) {
  return `${won.format(value)}원`;
}

export function formatSize(w: number, h: number, d?: number | null) {
  const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  return d ? `${n(w)} × ${n(h)} × ${n(d)} cm` : `${n(w)} × ${n(h)} cm`;
}

// 서버(Vercel)는 UTC라서 시각은 항상 한국 시간으로 고정해 보여준다.
const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function kstParts(iso: string) {
  const p = Object.fromEntries(KST.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return p as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

export function formatDate(iso: string) {
  const p = kstParts(iso);
  return `${p.year}.${p.month}.${p.day}`;
}

export function formatDateTime(iso: string) {
  const p = kstParts(iso);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

export function formatPeriod(start: string, end: string) {
  return `${start.replaceAll("-", ".")} – ${end.slice(5).replaceAll("-", ".")}`;
}

/** 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `${digits.slice(0, 3)}-****-${digits.slice(-4)}` : "****";
}
