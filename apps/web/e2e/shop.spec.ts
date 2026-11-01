import { expect, test } from "@playwright/test";
import { fill, placeOrder } from "./helpers";

test("browse the collection and filter by medium", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The collection" })).toBeVisible();
  await page.getByRole("button", { name: "가구", exact: true }).click();
  const cards = page.locator("#collection a[href^='/works/']");
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allInnerTexts()) expect(text).toContain(", 가구");
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

test("a work shows several photos, a process video and a 3D model", async ({ page }) => {
  await page.goto("/works/w-folding-chair");
  const thumbs = page.getByRole("button", { name: /번째 (사진|영상|3D 모델) 보기/ });
  await expect(thumbs).toHaveCount(4);
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.locator("main model-viewer")).toBeVisible();
  await expect(page.getByText("드래그해서 돌려 보세요")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.goto("/works/w-blue-afternoon");
  await page.getByRole("button", { name: /번째 영상 보기/ }).click();
  await expect(page.locator("main video")).toHaveAttribute("poster", /painting-process\.jpg$/);
});
