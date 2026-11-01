import { expect, test } from "@playwright/test";
import { adminLogin, placeOrder } from "./helpers";

test("admin pages redirect to login and reject a wrong password", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("관리자 비밀번호").fill("wrong");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("비밀번호가 맞지 않아요")).toBeVisible();
});

test("a forged session cookie never receives buyer data", async ({ page, request, baseURL }) => {
  await placeOrder(page, "w-study-window");
  for (const path of ["/admin/orders", "/admin"]) {
    const res = await request.get(path, { headers: { Cookie: "mayo_admin=9999999999.forged" }, maxRedirects: 0 });
    const body = await res.text();
    expect(body).not.toContain("010-2222-3333");
    expect(body).not.toContain("buyer@example.com");
  }
  const csv = await request.get(`${baseURL}/admin/ledger.csv`, { headers: { Cookie: "mayo_admin=9999999999.forged" }, maxRedirects: 0 });
  expect([307, 401]).toContain(csv.status());
});

test("confirming payment marks the work sold and lands in the ledger", async ({ page }) => {
  const code = await placeOrder(page, "w-small-stool");
  await adminLogin(page);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: code }).click();
  await page.getByRole("button", { name: "입금 확인" }).click();
  await expect(page.getByRole("button", { name: "배송 준비 시작" })).toBeVisible();
  await page.goto("/works/w-small-stool");
  await expect(page.getByRole("button", { name: "판매 완료된 작품입니다" })).toBeVisible();
  const csv = await page.request.get("/admin/ledger.csv");
  expect(await csv.text()).toContain(code);
});

test("admin registers a work with an uploaded photo", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/works/new");
  await page.locator('[name="title"]').fill("E2E 조각");
  await page.locator('[name="artistId"]').selectOption({ label: "최서준" });
  await page.locator('[name="medium"]').selectOption("sculpture");
  for (const [n, v] of [["materials", "청동"], ["widthCm", "30"], ["heightCm", "50"], ["price", "500000"]]) await page.locator(`[name="${n}"]`).fill(v);
  await page.locator('[name="newImages"]').setInputFiles("e2e/fixtures/artwork.png");
  await page.getByRole("button", { name: "작품 등록" }).click();
  await expect(page.getByText("저장했어요")).toBeVisible();
  const workId = new URL(page.url()).pathname.split("/").pop();
  await page.goto(`/works/${workId}`);
  await expect(page.getByRole("heading", { name: "「E2E 조각」" })).toBeVisible();
  const src = await page.locator("main img").first().getAttribute("src");
  const img = await page.request.get(src!);
  expect(img.headers()["content-type"]).toBe("image/png");
});

test("repeated wrong passwords get locked out", async ({ browser }) => {
  // 잠금은 IP 단위라, 다른 테스트를 막지 않도록 이 테스트만 다른 IP로 보낸다
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": "203.0.113.77" } });
  const page = await ctx.newPage();
  await page.goto("/admin/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("관리자 비밀번호").fill(`wrong-${i}`);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("비밀번호가 맞지 않아요")).toBeVisible();
  }
  await page.getByLabel("관리자 비밀번호").fill("e2e-admin-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("요청이 너무 많아요")).toBeVisible();
  await ctx.close();
});

test("uploads that are not really images are refused", async ({ page }) => {
  const { adminLogin } = await import("./helpers");
  await adminLogin(page);
  await page.goto("/admin/works/new");
  await page.locator('[name="title"]').fill("가짜 이미지");
  await page.locator('[name="artistId"]').selectOption({ label: "최서준" });
  for (const [n, v] of [["materials", "x"], ["widthCm", "10"], ["heightCm", "10"], ["price", "1000"]]) await page.locator(`[name="${n}"]`).fill(v);
  await page.locator('[name="newImages"]').setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)></svg>") });
  await page.getByRole("button", { name: "작품 등록" }).click();
  await expect(page.getByText("JPG·PNG·WEBP·AVIF 이미지만 올릴 수 있어요")).toBeVisible();
});

test("ledger CSV neutralises formula injection", async ({ page }) => {
  const { adminLogin, placeOrder } = await import("./helpers");
  // 작품명에 수식을 넣은 작품을 만들어 판매까지 진행
  await adminLogin(page);
  await page.goto("/admin/works/new");
  await page.locator('[name="title"]').fill('=HYPERLINK("http://evil","x")');
  await page.locator('[name="artistId"]').selectOption({ label: "최서준" });
  for (const [n, v] of [["materials", "x"], ["widthCm", "10"], ["heightCm", "10"], ["price", "1000"]]) await page.locator(`[name="${n}"]`).fill(v);
  await page.locator('[name="newImages"]').setInputFiles("e2e/fixtures/artwork.png");
  await page.getByRole("button", { name: "작품 등록" }).click();
  await expect(page.getByText("저장했어요")).toBeVisible();
  const workId = new URL(page.url()).pathname.split("/").pop()!;
  const code = await placeOrder(page, workId);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: code }).click();
  await page.getByRole("button", { name: "입금 확인" }).click();
  await expect(page.getByRole("button", { name: "배송 준비 시작" })).toBeVisible();
  const csv = await (await page.request.get("/admin/ledger.csv")).text();
  expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
});
