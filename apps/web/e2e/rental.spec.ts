import { expect, test } from "@playwright/test";
import { adminLogin, fill } from "./helpers";

test.beforeEach(async ({ page }, info) => {
  await page.setExtraHTTPHeaders({ "x-real-ip": `10.8.${info.workerIndex}.${(info.title.length * 11) % 250}` });
});

test("rental: request from the work page, confirm holds the work, return frees it", async ({ page }) => {
  await page.goto("/works/w-plaster-form");
  await expect(page.getByText(/렌탈도 할 수 있어요/)).toBeVisible();
  await page.getByRole("link", { name: "렌탈 신청" }).click();
  await expect(page).toHaveURL(/\/rental\/apply\?work=w-plaster-form/);
  await page.locator('[name="months"]').selectOption("3");
  await fill(page, { startDate: "2026-12-01", name: "렌탈회원", email: "rent@example.com", phone: "010-4444-5555", address: "서울시 성동구 예시로 12", spaceNote: "거실 소파 위 벽, 폭 2m" });
  await page.getByRole("button", { name: "렌탈 신청하기" }).click();
  await expect(page.getByText("렌탈 조건을 확인해 주세요")).toBeVisible();
  await page.locator('[name="agreeRental"]').check();
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "렌탈 신청하기" }).click();
  await expect(page.getByText("렌탈 신청이 접수됐어요")).toBeVisible();
  const code = (await page.locator("button", { hasText: /^R-/ }).innerText()).split("\n")[0].replace(/복사.*/, "").trim();

  // 번호로 진행 상황 조회
  await page.goto("/my");
  await expect(page.getByText(code)).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/rentals");
  const row = page.locator("li", { hasText: code });
  await row.getByRole("button", { name: "계약 확정, 설치 준비" }).click();
  await expect(page.locator("li", { hasText: code }).getByText("계약 확정, 설치 준비").first()).toBeVisible();

  // 확정되면 장바구니로 살 수 없다
  await page.goto("/works/w-plaster-form");
  await expect(page.getByRole("button", { name: "장바구니에 담기" })).toHaveCount(0);

  await page.goto("/admin/rentals");
  await page.locator("li", { hasText: code }).getByRole("button", { name: "렌탈 중" }).click();
  await expect(page.locator("li", { hasText: code }).getByRole("button", { name: "반납 완료" })).toBeVisible();
  await page.locator("li", { hasText: code }).getByRole("button", { name: "반납 완료" }).click();
  await expect(page.locator("li", { hasText: code }).getByRole("button", { name: "반납 완료" })).toHaveCount(0);
  await page.goto("/works/w-plaster-form");
  await expect(page.getByRole("button", { name: "장바구니에 담기" })).toBeVisible();
});

test("기업전용관 is in the header, and a consultation reaches the admin", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "기업전용관" }).click();
  await expect(page.getByRole("heading", { name: "기업전용관", level: 1 })).toBeVisible();
  await page.locator('[name="kind"]').selectOption("exhibition");
  await fill(page, { company: "카페 예시", bizNumber: "123-45-67890", name: "담당자", email: "biz@example.com", phone: "02-123-4567", space: "1층 홀 25평", budget: "월 80만 원", mood: "따뜻한 도자, 나무" });
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "상담 신청하기" }).click();
  await expect(page.getByText("기업 상담 신청이 접수됐어요")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/consultations");
  const item = page.locator("li", { hasText: "카페 예시" });
  await expect(item).toContainText("기업 공간 전시");
  await item.locator('[name="answer"]').fill("로비용 도자 6점과 회화 2점을 제안드려요.");
  await item.getByRole("button", { name: "제안 보내기" }).click();
  await expect(page.locator("li", { hasText: "카페 예시" })).toContainText("제안 드림");
});

test("gift order with gift wrapping, and the 50만 원 이하 filter", async ({ page }) => {
  await page.goto("/works");
  await page.getByRole("button", { name: "50만 원 이하" }).click();
  await expect(page.locator('a[href="/works/w-red-roofs"]:visible')).toHaveCount(0); // 240만 원
  await expect(page.locator('a[href="/works/w-study-window"]:visible').first()).toBeVisible(); // 6만 원

  await page.goto("/works/w-night-garden");
  await page.getByRole("button", { name: "장바구니에 담기" }).click();
  await page.goto("/cart");
  await page.locator('[name="packaging"]').selectOption("gift");
  await page.getByLabel("선물하기 (받는 분에게 바로 보내요)").check();
  await fill(page, { name: "보내는사람", phone: "010-1111-2222", email: "giver@example.com", address: "서울시 종로구 받는로 3", depositorName: "보내는사람", recipientName: "받는사람", recipientPhone: "010-3333-1111", giftMessage: "집들이 축하해" });
  for (const n of ["agreeTerms", "agreePrivacy", "agreeAge"]) await page.locator(`[name="${n}"]`).check();
  await page.getByRole("button", { name: "주문 신청하기" }).click();
  await page.waitForURL(/\/orders\/MAYO-/);
  await expect(page.getByText(/포장 \(선물 포장/)).toBeVisible();
  const orderCode = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);

  // 관리자 주문 화면에 선물 정보, 다른 테스트를 위해 주문은 취소해 작품을 돌려놓는다
  await adminLogin(page);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: orderCode }).click();
  await expect(page.getByText(/받는 분 받는사람/)).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("button", { name: "입금 확인" })).toHaveCount(0);
  await page.goto("/works/w-night-garden");
  await expect(page.getByRole("button", { name: "장바구니에 담기" })).toBeVisible();
});
