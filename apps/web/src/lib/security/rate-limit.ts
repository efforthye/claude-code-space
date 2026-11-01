import "server-only";
import { headers } from "next/headers";

/**
 * 고정 창(fixed window) 요청 제한 — 프로세스 메모리 기준.
 * 서버 한 대(개발, 홈서버)에선 그대로 막히고, 서버리스 여러 인스턴스에선 인스턴스마다
 * 따로 센다(완전한 방어가 아니라 남용 완화). 실서비스 규모가 되면 Redis 같은 공유 저장소로 옮긴다.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** limit 회를 windowMs 안에 넘기면 false. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()) {
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/** 프록시(Vercel, Cloudflare)가 넣어 주는 클라이언트 IP. 없으면 "unknown"으로 한 묶음. */
export async function clientIp() {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** 세지 않고 지금 막혀 있는지만 본다 (실패만 세는 로그인 제한용). */
export function blocked(key: string, limit: number, now = Date.now()) {
  const b = buckets.get(key);
  return !!b && b.resetAt > now && b.count >= limit;
}

/** 서버 액션, 라우트에서 한 줄로: 넘으면 false */
export async function allow(scope: string, limit: number, windowMs: number) {
  return hit(`${scope}:${await clientIp()}`, limit, windowMs);
}

export const TOO_MANY = "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";

/** 테스트용 */
export function resetRateLimits() {
  buckets.clear();
}
