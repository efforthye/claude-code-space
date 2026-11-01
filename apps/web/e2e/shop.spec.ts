import { expect, test } from "@playwright/test";
import { fill, placeOrder } from "./helpers";

test("the works page filters by admin-managed category", async ({ page }) => {
  await page.goto("/works");
  await expect(page.getByRole("heading", { name: "작품", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "가구", exact: true }).click();
  const cards = page.locator("main a[href^='/works/']");
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allInnerTexts()) expect(text).toMatch(/\n가구/);
});

test("work page shows verification and art-shipping notice", async ({ page }) => {
  await page.goto("/works/w-folding-chair");
  await expect(page.getByText("MAYO 학교 인증")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "주문이 접수됐어요" })).toBeVisible();
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

test("photos open full screen with a counter, arrows and zoom; the story follows", async ({ page }) => {
  await page.goto("/works/w-blue-afternoon");
  await expect(page.getByText("1 / 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /크게 보기/ }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer.getByText("1 / 3")).toBeVisible(); // 사진만 넘긴다 (영상 제외)
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText("2 / 3")).toBeVisible();
  await viewer.locator("img").click();
  await expect(viewer.getByText("움직여서 살펴보고, 다시 누르면 원래 크기")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "작품 이야기" })).toBeVisible();
  await expect(page.getByText("작업실 이젤. 창가 쪽에서 매일 같은 각도로 그렸어요.")).toBeVisible();

  // 사진이 한 장이어도 1 / 1
  await page.goto("/works/w-white-body");
  await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
});

test("schools are in Korean order with phase badges and a way in", async ({ page }) => {
  await page.goto("/schools");
  const names = await page.locator("main li h2").allTextContents();
  expect(names).toEqual([...names].sort(new Intl.Collator("ko").compare));
  await expect(page.locator("main").getByText(/^(예정|진행 중|종료)$/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "입점하기 →" }).first()).toHaveAttribute("href", "/join");
  await expect(page.getByRole("heading", { name: "우리 학교가 없나요?" })).toBeVisible();
});

test("a school chip on the home opens that school's works, shows and artists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /^홍익대학교/ }).first().click();
  await expect(page).toHaveURL(/\/schools\/sch-hongik$/);
  await expect(page.getByRole("heading", { name: "홍익대학교", level: 1 })).toBeVisible();
  // 홍익대 작가의 작품만
  const cards = page.locator("main a[href^='/works/']:visible");
  await expect(cards.first()).toBeVisible();
  // 다른 학교 작가(국민대 이민서, 한도윤, 이화여대 박유나)의 작품은 없다
  for (const text of await cards.allInnerTexts()) expect(text).not.toMatch(/이민서|한도윤|박유나/);
  await expect(page.getByRole("heading", { name: "Exhibitions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "김지은 회화과" })).toBeVisible();
});
