import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * 비밀번호 해시. OWASP Password Storage Cheat Sheet의 scrypt 최소 권장값
 * N=2^17, r=8, p=1 (메모리 약 128MiB). 저장 형식에 매개변수를 함께 남겨
 * 나중에 값을 올려도 예전 해시를 그대로 확인할 수 있다: scrypt$17$8$1$<salt>$<hash>
 */
const LOG_N = 17;
const R = 8;
const P = 1;
const KEY_LEN = 32;

function scrypt(password: string, salt: Buffer, logN: number, r: number, p: number) {
  const opts: ScryptOptions = { N: 2 ** logN, r, p, maxmem: 256 * 1024 * 1024 };
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, LOG_N, R, P);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** 없는 계정으로 로그인해도 같은 시간이 걸리도록 대신 확인할 해시 (사용자 열거 방지). */
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword(randomBytes(12).toString("base64url"));
  return dummy;
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** 너무 흔해서 가장 먼저 대입되는 비밀번호들 (조합 규칙 대신 이 목록만 막는다). */
const COMMON = new Set([
  "1234567890", "0123456789", "12345678910", "1q2w3e4r5t", "1qaz2wsx3edc", "qwertyuiop", "asdfghjkl;", "password12",
  "password123", "passw0rd12", "iloveyou12", "qwerty1234", "abcd123456", "a123456789", "1234qwer!!", "qwer1234!!",
  "0000000000", "1111111111", "aaaaaaaaaa", "abcdefghij", "mayo123456", "mayomayo12",
]);

/** 문제가 있으면 안내 문구, 없으면 null */
export function passwordProblem(password: string, email: string) {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상으로 해 주세요`;
  if (password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자까지 쓸 수 있어요`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "너무 흔한 비밀번호예요. 다른 걸로 해 주세요";
  if (email && lower.includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4) return "이메일 아이디가 들어간 비밀번호는 쓸 수 없어요";
  return null;
}
