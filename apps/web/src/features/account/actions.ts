"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { READONLY_MESSAGE, store, STORE_READONLY } from "@/lib/data/store";
import { isUnder14 } from "@/lib/domain/rules";
import { newId } from "@/lib/ids";
import { allow, blocked, clientIp, hit, TOO_MANY } from "@/lib/security/rate-limit";
import { dummyHash, hashPassword, passwordProblem, PASSWORD_MAX, verifyPassword } from "./password";
import { endSession, openSession, requireUser, safeNext, setSessionCookie } from "./session";

/** undefined = 아직 안 보냄, null = 성공 */
export type AccountFormState = { error: string; fields?: Record<string, string> } | null | undefined;

const get = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
const normEmail = (v: string) => v.trim().toLowerCase();

/** 로그인 실패 메시지는 하나로 (계정이 있는지 알려 주지 않는다) */
const LOGIN_FAILED = "이메일 또는 비밀번호를 확인해 주세요";
/** 계정당 실패 허용: 15분에 5번 (IP를 바꿔도 같은 계정은 막힌다) */
const ACCOUNT_FAILS = 5;
const FAIL_WINDOW = 15 * 60_000;

const SignupInput = z.object({
  email: z.string().email("이메일 주소를 확인해 주세요").max(120),
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(40),
  phone: z.string().trim().max(20).regex(/^[0-9+\-\s()]*$/, "연락처는 숫자와 +, - 만 써 주세요"),
  birthYear: z.number().int().min(1900, "출생연도를 확인해 주세요").max(new Date().getFullYear(), "출생연도를 확인해 주세요"),
  agreeTerms: z.literal(true, { error: "이용약관에 동의해 주세요" }),
  agreePrivacy: z.literal(true, { error: "개인정보 수집 및 이용에 동의해 주세요" }),
});

export async function signup(_prev: AccountFormState, form: FormData): Promise<AccountFormState> {
  const fields = { email: get(form, "email"), name: get(form, "name"), phone: get(form, "phone"), birthYear: get(form, "birthYear") };
  if (STORE_READONLY) return { error: READONLY_MESSAGE, fields };
  if (!(await allow("signup", 5, 60 * 60_000))) return { error: TOO_MANY, fields };
  const parsed = SignupInput.safeParse({
    email: normEmail(fields.email),
    name: fields.name,
    phone: fields.phone,
    birthYear: Number(fields.birthYear),
    agreeTerms: form.get("agreeTerms") === "on",
    agreePrivacy: form.get("agreePrivacy") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  // 만 14세 미만은 법정대리인 동의 절차가 필요해 온라인 가입을 받지 않는다 (개인정보 보호법 제22조의2)
  if (isUnder14(d.birthYear)) return { error: "만 14세 미만은 보호자와 함께 문의하기로 연락해 주세요", fields };
  const password = String(form.get("password") ?? "");
  const problem = passwordProblem(password, d.email);
  if (problem) return { error: problem, fields };
  if (password !== String(form.get("passwordConfirm") ?? "")) return { error: "비밀번호 확인이 일치하지 않아요", fields };

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const token = await store.update((db) => {
    if (db.users.some((u) => u.email === d.email)) return null;
    const id = newId("usr");
    db.users.push({ id, email: d.email, name: d.name, phone: d.phone || null, birthYear: d.birthYear, passwordHash, createdAt: now, agreedAt: now });
    return openSession(db, id);
  });
  // 이미 있는 이메일: 가입 화면에서는 알려 줄 수밖에 없다 (중복 가입 방지). 대신 요청 수를 제한한다.
  if (!token) return { error: "이미 가입된 이메일이에요. 로그인해 주세요", fields };
  await setSessionCookie(token);
  redirect(safeNext(get(form, "next")));
}

export async function login(_prev: AccountFormState, form: FormData): Promise<AccountFormState> {
  const email = normEmail(get(form, "email"));
  const fields = { email };
  if (STORE_READONLY) return { error: READONLY_MESSAGE, fields };
  const password = String(form.get("password") ?? "").slice(0, PASSWORD_MAX + 1);
  const ipKey = `login-fail:${await clientIp()}`;
  const accountKey = `login-fail-account:${email}`;
  // 막혀 있어도 같은 문구 (잠긴 계정인지도 알려 주지 않는다)
  if (blocked(ipKey, 20) || blocked(accountKey, ACCOUNT_FAILS)) return { error: `${LOGIN_FAILED}. 여러 번 틀리면 잠시 뒤에 다시 시도할 수 있어요`, fields };

  const db = await store.read();
  const user = db.users.find((u) => u.email === email);
  // 계정이 없어도 같은 계산을 한다 (응답 시간으로 계정 유무를 알 수 없게)
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) {
    hit(ipKey, 20, FAIL_WINDOW);
    hit(accountKey, ACCOUNT_FAILS, FAIL_WINDOW);
    return { error: LOGIN_FAILED, fields };
  }
  const token = await store.update((d) => openSession(d, user.id));
  await setSessionCookie(token);
  redirect(safeNext(get(form, "next")));
}

export async function logout() {
  await endSession();
  redirect("/");
}

/* ───────────────────────── 마이페이지 ───────────────────────── */

const CODE = /^(MAYO|J|E|Q)-[2-9A-HJ-NP-Z]{8}$/;

/**
 * 번호로 내 계정에 연결. 번호를 가진 사람 = 그 주문, 신청을 넣은 사람이라는 기존 원칙 그대로.
 * 이미 다른 회원에게 연결된 건은 건드리지 않는다.
 */
export async function claimCodes(codes: string[]) {
  const me = await requireUser();
  if (STORE_READONLY) return { linked: 0 };
  if (!(await allow("claim", 30, 10 * 60_000))) return { linked: 0 };
  const wanted = [...new Set(codes.map((c) => c.trim().toUpperCase()))].filter((c) => CODE.test(c)).slice(0, 50);
  const linked = await store.update((db) => {
    let n = 0;
    for (const rows of [db.orders, db.applications, db.exhibitionRequests, db.inquiries] as Array<Array<{ code: string; userId?: string | null }>>) {
      for (const row of rows) {
        if (wanted.includes(row.code) && !row.userId) {
          row.userId = me.id;
          n++;
        }
      }
    }
    return n;
  });
  refresh();
  return { linked };
}

export async function claimCodeForm(_prev: AccountFormState, form: FormData): Promise<AccountFormState> {
  const code = get(form, "code").toUpperCase();
  if (!CODE.test(code)) return { error: "번호 형식을 확인해 주세요 (예: MAYO-ABCD2345)" };
  const { linked } = await claimCodes([code]);
  return linked ? null : { error: "연결할 수 있는 번호가 아니에요. 이미 연결됐거나 번호가 다를 수 있어요" };
}

const ProfileInput = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(40),
  phone: z.string().trim().max(20).regex(/^[0-9+\-\s()]*$/, "연락처는 숫자와 +, - 만 써 주세요"),
});

export async function updateProfile(_prev: AccountFormState, form: FormData): Promise<AccountFormState> {
  const me = await requireUser();
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  const parsed = ProfileInput.safeParse({ name: get(form, "name"), phone: get(form, "phone") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await store.update((db) => {
    const u = db.users.find((x) => x.id === me.id);
    if (u) Object.assign(u, { name: parsed.data.name, phone: parsed.data.phone || null });
  });
  refresh();
  return null;
}

export async function changePassword(_prev: AccountFormState, form: FormData): Promise<AccountFormState> {
  const me = await requireUser();
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  if (!(await allow("password-change", 10, 15 * 60_000))) return { error: TOO_MANY };
  const db = await store.read();
  const user = db.users.find((u) => u.id === me.id);
  if (!user || !(await verifyPassword(String(form.get("currentPassword") ?? ""), user.passwordHash))) return { error: "지금 비밀번호가 맞지 않아요" };
  const next = String(form.get("newPassword") ?? "");
  const problem = passwordProblem(next, user.email);
  if (problem) return { error: problem };
  if (next !== String(form.get("newPasswordConfirm") ?? "")) return { error: "새 비밀번호 확인이 일치하지 않아요" };
  const passwordHash = await hashPassword(next);
  // 비밀번호를 바꾸면 다른 기기의 세션은 모두 끊고, 이 기기엔 새 세션을 준다
  const token = await store.update((d) => {
    const u = d.users.find((x) => x.id === me.id);
    if (!u) return null;
    u.passwordHash = passwordHash;
    d.sessions = d.sessions.filter((s) => s.userId !== me.id);
    return openSession(d, me.id);
  });
  if (token) await setSessionCookie(token);
  return null;
}

/**
 * 회원 탈퇴. 계정과 세션은 바로 지우고, 주문 기록은 전자상거래법상 보존 의무(5년)가 있어
 * 회원 연결만 끊고 남긴다.
 */
export async function deleteAccount(_prev: AccountFormState, form: FormData): Promise<AccountFormState> {
  const me = await requireUser();
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  if (get(form, "confirm") !== "탈퇴") return { error: "확인란에 탈퇴라고 적어 주세요" };
  const db = await store.read();
  const user = db.users.find((u) => u.id === me.id);
  if (!user || !(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) return { error: "비밀번호가 맞지 않아요" };
  await store.update((d) => {
    d.users = d.users.filter((u) => u.id !== me.id);
    d.sessions = d.sessions.filter((s) => s.userId !== me.id);
    for (const rows of [d.orders, d.applications, d.exhibitionRequests, d.inquiries] as Array<Array<{ userId?: string | null }>>) {
      for (const row of rows) if (row.userId === me.id) row.userId = null;
    }
  });
  await endSession();
  redirect("/?bye=1");
}
