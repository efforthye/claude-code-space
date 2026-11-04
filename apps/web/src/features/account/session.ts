import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { store } from "@/lib/data/store";
import type { Database, User } from "@/lib/domain/types";

/**
 * 회원 세션 (OWASP Session Management Cheat Sheet):
 * - 토큰 256비트 무작위, 저장소에는 SHA-256만
 * - 실서비스 쿠키는 __Host- 접두사 + Secure + HttpOnly + SameSite=Lax (다른 사이트에서 링크로 들어와도 로그인 유지)
 * - 로그인할 때마다 새 토큰 (세션 고정 방지), 로그아웃은 서버에서 지운다
 * - 7일 동안 안 쓰면 만료, 아무리 써도 30일이면 만료
 */
const SECURE = process.env.NODE_ENV === "production";
export const USER_COOKIE = SECURE ? "__Host-mayo_session" : "mayo_session";
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_MS = 24 * 60 * 60 * 1000; // 하루에 한 번만 마지막 사용 시각을 쓴다

const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

/** 세션이 살아 있는지 (저장소를 바꾸지 않는 순수 판단, 테스트용으로 분리) */
export function isLive(s: { lastSeenAt: string; expiresAt: string }, now: number) {
  return Date.parse(s.expiresAt) > now && Date.parse(s.lastSeenAt) + IDLE_MS > now;
}

/** db 안에서 새 세션을 만들고 쿠키에 넣을 토큰을 돌려준다. store.update 안에서 부른다. */
export function openSession(db: Database, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const at = new Date(now).toISOString();
  // 만료된 세션은 이 기회에 치운다
  db.sessions = db.sessions.filter((s) => isLive(s, now));
  db.sessions.push({ tokenHash: hashToken(token), userId, createdAt: at, lastSeenAt: at, expiresAt: new Date(now + ABSOLUTE_MS).toISOString() });
  return token;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(USER_COOKIE, token, { httpOnly: true, secure: SECURE, sameSite: "lax", path: "/", maxAge: ABSOLUTE_MS / 1000 });
}

export async function clearSessionCookie() {
  (await cookies()).delete(USER_COOKIE);
}

export type Me = Pick<User, "id" | "email" | "name" | "phone" | "birthYear" | "createdAt"> & {
  avatar: string | null;
  cover: string | null;
  bio: string | null;
  verification: User["verification"] | null;
};

/** 지금 로그인한 회원 (없으면 null). 화면에 넘길 때 비밀번호 해시는 빼고 준다. */
export async function currentUser(): Promise<Me | null> {
  await connection();
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const now = Date.now();
  const db = await store.read();
  const session = db.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || !isLive(session, now)) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  if (now - Date.parse(session.lastSeenAt) > TOUCH_MS) {
    await store
      .update((d) => {
        const s = d.sessions.find((x) => x.tokenHash === tokenHash);
        if (s) s.lastSeenAt = new Date(now).toISOString();
      })
      .catch(() => undefined); // 읽기 전용 저장소에서도 로그인 판단은 계속한다
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    birthYear: user.birthYear,
    createdAt: user.createdAt,
    avatar: user.avatar ?? null,
    cover: user.cover ?? null,
    bio: user.bio ?? null,
    verification: user.verification ?? null,
  };
}

/** 회원 전용 화면, 액션의 입구. 로그인이 안 돼 있으면 로그인 화면으로 (돌아올 주소와 함께). */
export async function requireUser(next = "/account") {
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  return me;
}

/** 현재 쿠키의 세션을 서버에서 지운다. */
export async function endSession() {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await store.update((db) => {
      db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
    });
  }
  await clearSessionCookie();
}

/** 로그인 뒤 돌아갈 주소. 같은 사이트 경로만 허용 (열린 리디렉션 방지). */
export function safeNext(next: string | null | undefined, fallback = "/account") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
