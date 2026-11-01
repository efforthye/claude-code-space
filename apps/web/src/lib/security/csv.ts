/**
 * CSV 셀 — 엑셀이 수식으로 실행하지 않도록 =,+,-,@,탭,CR로 시작하면 ' 를 붙이고 따옴표로 감싼다.
 * (작품명, 작가명은 사용자가 입력한 값이라 "=HYPERLINK(...)" 같은 주입이 가능하다.)
 */
export function csvCell(value: string | number) {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
