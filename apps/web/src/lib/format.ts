const won = new Intl.NumberFormat("ko-KR");

export function formatPrice(value: number) {
  return `${won.format(value)}원`;
}

export function formatSize(w: number, h: number, d?: number | null) {
  const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  return d ? `${n(w)} × ${n(h)} × ${n(d)} cm` : `${n(w)} × ${n(h)} cm`;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatPeriod(start: string, end: string) {
  return `${start.replaceAll("-", ".")} – ${end.slice(5).replaceAll("-", ".")}`;
}

/** 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `${digits.slice(0, 3)}-****-${digits.slice(-4)}` : "****";
}
