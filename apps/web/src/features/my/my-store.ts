"use client";

/**
 * 이 기기에서 넣은 신청, 주문, 문의 번호를 기억한다(로그인 없음). 상태는 서버에 번호로 묻는다.
 * 번호를 아는 사람만 조회할 수 있고, 응답에는 개인정보를 담지 않는다.
 */
export type MyEntry = { code: string; title: string; at: string };

const KEY = "mayo.my.v1";

export function readMine(): MyEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function rememberMine(entry: MyEntry) {
  try {
    const rest = readMine().filter((e) => e.code !== entry.code);
    localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, 50)));
  } catch {
    // storage blocked, the code is still shown on screen
  }
}

export function forgetMine(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readMine().filter((e) => e.code !== code)));
  } catch {}
}
