import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const PAGES = ["/", "/works", "/works/w-blue-afternoon", "/exhibitions", "/exhibitions/exh-26f-hongik-wood", "/artists", "/schools", "/cart", "/join", "/exhibitions/apply", "/contact", "/my"];

for (const path of PAGES) {
  test(`no horizontal overflow at 390px: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
