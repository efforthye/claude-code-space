import "server-only";

/**
 * 결제 수단 seam. 지금은 사업자 계좌 무통장 입금 + 관리자 입금 확인.
 * PG(토스페이먼츠/포트원 등)를 붙이면 여기에 두 번째 구현을 추가하고
 * 주문 생성 시 method로 고른다. 계좌 정보는 환경변수로만 받는다(저장소에 두지 않음).
 */
export type BankAccount = { bankName: string; accountNumber: string; accountHolder: string };

export function getBankAccount(): BankAccount | null {
  const bankName = process.env.BANK_NAME;
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER;
  const accountHolder = process.env.BANK_ACCOUNT_HOLDER;
  if (!bankName || !accountNumber || !accountHolder) return null;
  return { bankName, accountNumber, accountHolder };
}
