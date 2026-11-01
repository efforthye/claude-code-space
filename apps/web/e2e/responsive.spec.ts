import { expect, test } from "@playwright/test";

const PAGES = ["/", "/works", "/works/w-blue-afternoon", "/exhibitions", "/exhibitions/exh-26f-hongik-wood", "/artists", "/artists/art-jieun", "/schools", "/schools/sch-hongik", "/cart", "/join", "/exhibitions/apply", "/contact", "/my", "/login", "/signup"];

// 일반 휴대폰(390), 작은 휴대폰(320), 폴더블 접힌 화면(280)
for (const width of [390, 320, 280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    for (const path of PAGES) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });
    }
  });
}

test.describe("phone menu", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the hamburger opens the menu, links navigate and close it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation").filter({ hasText: "작품" })).toBeHidden(); // 알약 내비는 숨김
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const menu = page.getByRole("dialog", { name: "메뉴" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "로그인" })).toBeVisible();
    await menu.getByRole("link", { name: /^작가/ }).click();
    await expect(page).toHaveURL(/\/artists$/);
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "메뉴" })).toBeHidden();
  });
});
