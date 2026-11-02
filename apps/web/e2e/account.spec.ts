import { expect, test, type Page } from "@playwright/test";
import { fill, placeOrder } from "./helpers";

const PASSWORD = "a long sentence passphrase 2026";

async function signup(page: Page, email: string) {
  await page.goto("/signup");
  await fill(page, { email, password: PASSWORD, passwordConfirm: PASSWORD, name: "테스트회원", birthYear: "1999", phone: "010-1234-5678" });
  await page.locator('[name="agreeTerms"]').check();
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.beforeEach(async ({ page }, info) => {
  // 가입, 로그인 요청 제한이 테스트끼리 섞이지 않게 테스트마다 다른 IP로
  await page.setExtraHTTPHeaders({ "x-real-ip": `10.9.${info.workerIndex}.${(info.title.length * 7) % 250}` });
});

test("signing up puts 마이페이지 top right, and an order lands on it with its certificate slot", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "로그인" })).toBeVisible();
  await signup(page, `member-${Date.now()}@example.com`);
  await expect(page.getByRole("heading", { name: "테스트회원님" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "마이페이지" })).toBeVisible();

  const code = await placeOrder(page, "w-late-summer");
  await page.goto("/account");
  await expect(page.getByRole("link", { name: code })).toBeVisible();
  await expect(page.getByText("「늦여름」")).toBeVisible();

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "로그인" })).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});

test("a guest order can be linked to an account by its number, once", async ({ page }) => {
  const code = await placeOrder(page, "w-silver-ring-set");
  await page.waitForFunction((c) => localStorage.getItem("mayo.my.v1")?.includes(c), code);
  await signup(page, `claim-${Date.now()}@example.com`);
  // 이 기기에 기억된 번호를 가져오기
  await page.getByRole("button", { name: "가져오기" }).click();
  await expect(page.getByText(/건을 연결했어요/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: code })).toBeVisible();
  // 이미 연결된 번호는 다시 연결되지 않는다
  await page.getByLabel("연결할 번호").fill(code);
  await page.getByRole("button", { name: "연결", exact: true }).click();
  await expect(page.getByText(/연결할 수 있는 번호가 아니에요/)).toBeVisible();
});

test("login failures look the same whether or not the account exists", async ({ page }) => {
  const email = `login-${Date.now()}@example.com`;
  await signup(page, email);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "로그인" })).toBeVisible();

  for (const [who, pw] of [[email, "wrong password here"], [`nobody-${Date.now()}@example.com`, PASSWORD]]) {
    await page.goto("/login");
    await fill(page, { email: who, password: pw });
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("이메일 또는 비밀번호를 확인해 주세요");
  }

  await page.goto("/login?next=/works");
  await fill(page, { email, password: PASSWORD });
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/works$/);
});

test("signup refuses under-14s, weak passwords and duplicates; open redirects are ignored", async ({ page }) => {
  await page.goto("/signup");
  const email = `rules-${Date.now()}@example.com`;
  await fill(page, { email, password: "1234567890", passwordConfirm: "1234567890", name: "규칙", birthYear: "1999" });
  await page.locator('[name="agreeTerms"]').check();
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("흔한 비밀번호");
  await fill(page, { password: PASSWORD, passwordConfirm: PASSWORD, birthYear: String(new Date().getFullYear() - 10) });
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("만 14세 미만");

  await page.goto("/signup?next=https://evil.example");
  await fill(page, { email, password: PASSWORD, passwordConfirm: PASSWORD, name: "규칙", birthYear: "1999" });
  await page.locator('[name="agreeTerms"]').check();
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/account$/);

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "로그인" })).toBeVisible();
  await page.goto("/signup");
  await fill(page, { email, password: PASSWORD, passwordConfirm: PASSWORD, name: "규칙", birthYear: "1999" });
  await page.locator('[name="agreeTerms"]').check();
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("이미 가입된 이메일");
});

test("changing the password signs out other devices", async ({ page, browser }) => {
  const email = `pw-${Date.now()}@example.com`;
  await signup(page, email);
  const other = await browser.newPage();
  await other.goto("/login");
  await fill(other, { email, password: PASSWORD });
  await other.getByRole("button", { name: "로그인" }).click();
  await expect(other).toHaveURL(/\/account$/);

  const next = "another long passphrase 2027";
  await fill(page, { currentPassword: PASSWORD, newPassword: next, newPasswordConfirm: next });
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.getByText(/다른 기기에서는 다시 로그인/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "테스트회원님" })).toBeVisible(); // 이 기기는 그대로

  await other.goto("/account");
  await expect(other).toHaveURL(/\/login/); // 다른 기기는 끊겼다
  await other.close();
});

test("artists can be searched, filtered by school and sorted; profiles show a studio", async ({ page }) => {
  await page.goto("/artists");
  await page.getByLabel("작가 검색").fill("목조형");
  await expect(page.getByText("작가 1명")).toBeVisible();
  await expect(page.getByRole("link", { name: /정하나/ })).toBeVisible();
  await page.getByLabel("작가 검색").fill("");
  await page.getByLabel("학교").selectOption({ label: "국민대학교" });
  await expect(page.getByText("작가 2명")).toBeVisible();
  await page.getByLabel("학교").selectOption("all");
  await page.getByLabel("작가 검색").fill("없는작가이름");
  await expect(page.getByText("조건에 맞는 작가가 없어요")).toBeVisible();

  await page.goto("/artists/art-jieun");
  await expect(page.getByRole("heading", { name: "작업실" })).toBeVisible();
  await expect(page.getByText("서향 창이 있는 자취방 한쪽이 작업실이에요.")).toBeVisible();
  await expect(page.getByRole("img", { name: "김지은 프로필 사진" })).toBeVisible();
});
