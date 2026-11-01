import { expect, test } from "@playwright/test";
import { fill, placeOrder } from "./helpers";

test("browse the collection and filter by medium", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "졸업전시 컬렉션" })).toBeVisible();
  await page.getByRole("button", { name: "가구", exact: true }).click();
  const cards = page.locator("#collection a[href^='/works/']");
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allInnerTexts()) expect(text).toMatch(/나무|합판|오크/);
});

test("work page shows verification and art-shipping notice", async ({ page }) => {
  await page.goto("/works/w-folding-chair");
  await expect(page.getByText("MAYO 인증")).toBeVisible();
  await expect(page.getByText("미술품 전문 운송 대상")).toBeVisible();
});

test("order form keeps what you typed when validation fails", async ({ page }) => {
  await page.goto("/works/w-night-garden");
  await page.getByRole("button", { name: "장바구니에 담기" }).click();
  await page.goto("/cart");
  await fill(page, { name: "김테스트", phone: "010-1111-2222", email: "user@invalid", address: "서울" });
  await page.getByRole("button", { name: "주문 신청하기" }).click();
  await expect(page.getByText("이메일을 확인해 주세요")).toBeVisible();
  await expect(page.locator('[name="name"]')).toHaveValue("김테스트");
});

test("placing an order reserves the work, celebrates and lands in 내 신청 현황", async ({ page }) => {
  const code = await placeOrder(page, "w-hammered-bowl");
  await expect(page.getByRole("heading", { name: /첫 원화가 곧 당신의 벽으로/ })).toBeVisible();
  await expect(page.getByText("000-0000-0000")).toBeVisible(); // bank account from env
  await page.goto("/works/w-hammered-bowl");
  await expect(page.getByRole("button", { name: "다른 컬렉터가 예약 중입니다" })).toBeVisible();
  await page.goto("/my");
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByText("입금 대기")).toBeVisible();
});
