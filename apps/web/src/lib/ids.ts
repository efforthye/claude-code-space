import { randomBytes, randomUUID } from "node:crypto";

export const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

// 0/O, 1/I/L 처럼 헷갈리는 글자를 뺀 32자. 8자리 ≈ 40비트 — 추측으로 남의 주문을 열기 어렵다.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newOrderCode() {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `MAYO-${s}`;
}
