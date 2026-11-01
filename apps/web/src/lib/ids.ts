import { randomBytes, randomUUID } from "node:crypto";

export const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

// 0/O, 1/I/L 처럼 헷갈리는 글자를 뺀 32자. 8자리 ≈ 40비트 — 추측으로 남의 주문을 열기 어렵다.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(len = 8) {
  let s = "";
  for (const b of randomBytes(len)) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export const newOrderCode = () => `MAYO-${randomCode()}`;

/** 신청 현황 조회 코드: J = 작가 입점, E = 전시 등록, Q = 문의 */
export const newTrackingCode = (kind: "J" | "E" | "Q") => `${kind}-${randomCode()}`;
