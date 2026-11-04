import "server-only";
import { headers } from "next/headers";
import { ensureIndex, mongoDb, USE_MONGO } from "@/lib/data/mongo";

/**
 * 고정 창(fixed window) 요청 제한.
 * - MongoDB가 연결되면 모든 서버리스 인스턴스가 같은 카운터를 쓴다 (count, isBlocked, allow)
 * - 아니면(개발, 테스트) 프로세스 메모리로 센다 (hit, blocked)
 * DB가 잠깐 안 될 때는 메모리로 넘어간다: 막지 못하는 것보다 인스턴스별로라도 세는 게 낫다.
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

type LimitDoc = { _id: string; count: number; resetAt: Date };

async function limits() {
  await ensureIndex("rate_limits", { resetAt: 1 }, { expireAfterSeconds: 0, name: "expire_at_reset" });
  return (await mongoDb()).collection<LimitDoc>("rate_limits");
}

/** 공유 카운터 +1. limit 회를 windowMs 안에 넘기면 false */
export async function count(key: string, limit: number, windowMs: number) {
  if (!USE_MONGO) return hit(key, limit, windowMs);
  try {
    const col = await limits();
    const now = new Date();
    const doc = await col.findOneAndUpdate({ _id: key, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { returnDocument: "after" });
    if (doc) return doc.count <= limit;
    // 창이 없거나 끝났다: 새 창을 연다
    await col.updateOne({ _id: key }, { $set: { count: 1, resetAt: new Date(now.getTime() + windowMs) } }, { upsert: true });
    return true;
  } catch {
    return hit(key, limit, windowMs);
  }
}

/** 공유 카운터를 세지 않고 지금 막혀 있는지만 (실패만 세는 로그인 제한용) */
export async function isBlocked(key: string, limit: number) {
  if (!USE_MONGO) return blocked(key, limit);
  try {
    const doc = await (await limits()).findOne({ _id: key, resetAt: { $gt: new Date() } });
    return !!doc && doc.count >= limit;
  } catch {
    return blocked(key, limit);
  }
}

/** 서버 액션, 라우트에서 한 줄로: 넘으면 false */
export async function allow(scope: string, limit: number, windowMs: number) {
  return count(`${scope}:${await clientIp()}`, limit, windowMs);
}

export const TOO_MANY = "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";

/** 테스트용 */
export function resetRateLimits() {
  buckets.clear();
}
