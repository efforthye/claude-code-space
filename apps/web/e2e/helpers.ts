import { expect, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = "e2e-admin-password";

export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("관리자 비밀번호").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function fill(page: Page, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value);
}

/** 주문 하나를 끝까지 넣고 주문번호를 돌려준다. */
export async function placeOrder(page: Page, workId: string) {
  await page.goto(`/works/${workId}`);
  await page.getByRole("button", { name: "장바구니에 담기" }).click();
  await page.goto("/cart");
  await fill(page, { name: "구매자", phone: "010-2222-3333", email: "buyer@example.com", address: "서울시 마포구 예시로 1", depositorName: "구매자" });
  for (const n of ["agreeTerms", "agreePrivacy", "agreeAge"]) await page.locator(`[name="${n}"]`).check();
  await page.getByRole("button", { name: "주문 신청하기" }).click();
  await page.waitForURL(/\/orders\/MAYO-/);
  return decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
}
