import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminLogin, fill } from "./helpers";

const PASSWORD = "a long sentence passphrase 2026";
/** datetime-local 값 (한국 시각) */
const kst = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 16);

async function member(browser: Browser, name: string, slug: string, ip: string): Promise<Page> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": ip } });
  const page = await ctx.newPage();
  await page.goto("/signup");
  await fill(page, { email: `${slug}-${Date.now()}@example.com`, password: PASSWORD, passwordConfirm: PASSWORD, name, birthYear: "1995", phone: "010-5555-6666" });
  await page.locator('[name="agreeTerms"]').check();
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 20_000 });
  return page;
}

test("auction: proxy bid, outbid notice, buy-now closes it, results disclose hammer and payment", async ({ page, browser }) => {
  test.setTimeout(120_000);
  // 운영자가 경매를 연다
  await adminLogin(page);
  await page.goto("/admin/auctions");
  await page.getByLabel("작품").selectOption("w-clay-time");
  await fill(page, { startPrice: "50000", increment: "10000", buyNowPrice: "350000", startsAt: kst(Date.now() - 3600_000), endsAt: kst(Date.now() + 2 * 86400_000) });
  await page.getByRole("button", { name: "경매 열기" }).click();
  await expect(page.getByRole("cell", { name: /흙의 시간/ })).toBeVisible();

  // 장바구니 대신 경매 칸, 경매 목록에도 뜬다
  await page.goto("/auctions");
  await expect(page.getByText("흙의 시간")).toBeVisible();

  // A: 최대 30만 원 자동입찰 → 시작가로 1등
  const a = await member(browser, "입찰A", "bidder-a", "10.7.0.1");
  await a.goto("/works/w-clay-time");
  await expect(a.getByRole("button", { name: "장바구니에 담기" })).toHaveCount(0);
  await a.getByRole("button", { name: "최대 금액 설정" }).click();
  const sheetA = a.getByRole("dialog", { name: "자동입찰 최대 금액 설정" });
  await sheetA.locator('[name="amount"]').fill("300000");
  await expect(sheetA.getByText("330,000원")).toBeVisible(); // 수수료 10% 포함 최대 결제 금액
  await sheetA.locator('[name="agreeAuction"]').check();
  await sheetA.getByRole("button", { name: /최대 300,000원으로 설정/ }).click();
  await expect(a.getByText("내가 최고 입찰 중")).toBeVisible();
  await expect(a.getByText("50,000원").first()).toBeVisible();

  // B: 5만 원 다음 단위로 한 번 입찰 → A의 자동입찰이 바로 이긴다
  const b = await member(browser, "입찰B", "bidder-b", "10.7.0.2");
  await b.goto("/works/w-clay-time");
  await b.getByRole("button", { name: "60,000원 입찰" }).click();
  const sheetB = b.getByRole("dialog", { name: "입찰 확인" });
  await sheetB.locator('[name="agreeAuction"]').check();
  await sheetB.getByRole("button", { name: "60,000원 입찰하기" }).click();
  await expect(b.getByText("최대 금액 초과됨")).toBeVisible();
  await expect(b.getByRole("list", { name: "입찰 내역" })).toContainText("자동입찰");
  // B 화면에는 A의 최대 금액이 없다
  await expect(b.getByRole("list", { name: "입찰 내역" })).not.toContainText("300,000원");

  // A 화면은 몇 초 안에 새 현재가로 바뀐다
  await expect(a.getByText("70,000원").first()).toBeVisible({ timeout: 15_000 });

  // B가 즉시구매 → 경매 종료, 낙찰 주문
  await b.getByRole("button", { name: /350,000원에 즉시구매/ }).click();
  await b.getByRole("button", { name: "즉시구매하고 경매 끝내기" }).click();
  await expect(b.getByText("경매가 끝났어요")).toBeVisible();
  await b.goto("/account/bids");
  await expect(b.getByText("390,000원")).toBeVisible(); // 35만 + 수수료 3.5만 + 택배 5천
  await b.getByLabel("받는 방법").selectOption("pickup");
  await b.getByRole("button", { name: "결제 정보 저장" }).click();
  await expect(b.getByText("저장했어요")).toBeVisible();
  await expect(b.getByText("385,000원")).toBeVisible(); // 직접 수령이면 택배비 없음

  // A의 내 경매에는 다른 사람 낙찰로
  await a.goto("/account/bids");
  await expect(a.getByText(/다른 분이 낙찰/)).toBeVisible();

  // 공시: 낙찰가, 결제 대기 → 입금 확인 후 완납
  await page.goto("/auctions/results");
  const row = page.getByRole("row", { name: /흙의 시간/ });
  await expect(row).toContainText("350,000원");
  await expect(row).toContainText("결제 기다리는 중");
  await expect(row).not.toContainText("입찰B");
  await page.goto("/admin/auctions");
  await page.getByRole("row", { name: /흙의 시간/ }).getByRole("link").click();
  await page.getByRole("button", { name: "입금 확인" }).click();
  await page.goto("/auctions/results");
  await expect(page.getByRole("row", { name: /흙의 시간/ })).toContainText("완납");
});

test("auction terms and results pages are public", async ({ page }) => {
  await page.goto("/legal/auction");
  await expect(page.getByRole("heading", { name: "경매 이용 약관" })).toBeVisible();
  await expect(page.getByText(/미술진흥법 제15조⑤3/)).toBeVisible();
  await page.goto("/auctions/results");
  await expect(page.getByRole("heading", { name: "경매 결과 공시" })).toBeVisible();
});
