import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { store } from "@/lib/data/store";

export const ADMIN_COOKIE = "mayo_admin";
const MAX_AGE_S = 60 * 60 * 12; // 12시간

/**
 * 세션 서명 키. 실서비스에 ADMIN_SESSION_SECRET(32자 이상)과 ADMIN_PASSWORD가 없으면
 * 관리자 로그인은 "꺼짐", 오류를 내지 않고 모든 확인이 실패한다.
 */
function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  return process.env.NODE_ENV !== "production" ? "dev-only-admin-secret-change-me-0000000000" : null;
}

export const ADMIN_ENABLED = secret() !== null;

function sign(payload: string) {
  const key = secret();
  if (!key) throw new Error("admin disabled");
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "mayo-dev" : "");
  if (!ADMIN_ENABLED || expected.length === 0) return false;
  return safeEqual(sign(input), sign(expected));
}

export function issueSessionValue() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: MAX_AGE_S };
}

export function isValidSession(value: string | undefined) {
  if (!value || !ADMIN_ENABLED) return false;
  const [exp, mac] = value.split(".");
  if (!exp || !mac || !safeEqual(mac, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}

/**
 * 데이터 가까이에서 하는 인증 확인. proxy.ts의 리디렉션은 화면 편의일 뿐이고,
 * 관리자 페이지, 서버 액션, CSV는 모두 이 함수를 거친다.
 */
export async function requireAdmin() {
  await connection(); // 세션 만료 판단(Date.now)은 항상 요청 시점에
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!isValidSession(value)) redirect("/admin/login");
}

/**
 * 관리자 화면의 유일한 데이터 입구. App Router는 레이아웃과 페이지를 병렬로
 * 렌더링하므로 레이아웃의 인증 확인만으로는 페이지 데이터가 응답에 섞일 수 있다.
 * 그래서 각 페이지가 데이터를 읽는 바로 그 자리에서 인증을 확인한다.
 */
export async function adminDb() {
  await requireAdmin();
  return store.read();
}
