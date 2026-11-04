import { expect, test, type Page } from "@playwright/test";
import { adminLogin, fill, placeOrder } from "./helpers";

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
  await expect(page.getByRole("heading", { name: /^테스트회원/, level: 1 })).toBeVisible();
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
  await page.goto("/account/requests");
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
  await page.goto("/account/settings");
  await fill(page, { currentPassword: PASSWORD, newPassword: next, newPasswordConfirm: next });
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.getByText(/다른 기기에서는 다시 로그인/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /^테스트회원/, level: 1 })).toBeVisible(); // 이 기기는 그대로

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

test("a member linked to an artist page sells from 마이페이지: work goes through review, profile shows publicly", async ({ page, browser }) => {
  const email = `seller-${Date.now()}@example.com`;
  await signup(page, email);
  await page.getByRole("tab", { name: "판매" }).click();
  await expect(page.getByText("아직 이 계정에 연결된 작가 페이지가 없어요")).toBeVisible();

  // 운영자가 작가 페이지에 이 회원을 연결한다
  const admin = await browser.newPage();
  await admin.setExtraHTTPHeaders({ "x-real-ip": "10.77.0.1" });
  await adminLogin(admin);
  await admin.goto("/admin/artists/art-doyun");
  await admin.getByLabel("연결된 회원 이메일").fill(email);
  await admin.getByRole("button", { name: "변경 저장" }).click();
  await expect(admin.getByLabel("연결된 회원 이메일")).toHaveValue(email);

  await page.goto("/account/sell");
  await expect(page.getByText("판매 중", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "작품 올리기" }).first().click();
  await fill(page, { title: "마이페이지에서 올린 그릇", materials: "백토", widthCm: "20", heightCm: "8", price: "88000" });
  await page.getByLabel("미디어 파일").setInputFiles("e2e/fixtures/artwork.png");
  await expect(page.getByRole("list", { name: "미디어 순서" }).locator("li")).toHaveCount(1);
  await page.getByRole("button", { name: "검수 요청하고 등록" }).click();
  await expect(page).toHaveURL(/\/account\/sell\/works\?saved=/);
  const workId = new URL(page.url()).searchParams.get("saved")!;
  await expect(page.getByText("검수 대기")).toBeVisible();
  await page.goto(`/works/${workId}`);
  await expect(page.getByText("찾는 페이지가 없어요")).toBeVisible(); // 검수 전엔 비공개
  await page.goto("/account/sell/works");

  await admin.goto("/admin/works");
  await admin.locator("tr", { hasText: "마이페이지에서 올린 그릇" }).getByRole("button", { name: "승인하고 공개" }).click();
  await expect(admin.locator("tr", { hasText: "마이페이지에서 올린 그릇" }).getByText("판매 중")).toBeVisible();
  await page.goto(`/works/${workId}`);
  await expect(page.getByRole("heading", { name: /마이페이지에서 올린 그릇/ })).toBeVisible();

  // 작가 프로필은 바로 작가 페이지에 보인다
  await page.goto("/account/sell/profile");
  await page.locator('textarea[name="bio"]').fill("마이페이지에서 고친 작가 소개입니다.");
  await page.getByRole("button", { name: "작가 프로필 저장" }).click();
  await expect(page.getByText("저장했어요. 작가 페이지에 바로 보여요.")).toBeVisible();
  await page.goto("/artists/art-doyun");
  await expect(page.getByText("마이페이지에서 고친 작가 소개입니다.")).toBeVisible();
  await admin.close();
});

test("school verification: a student ID photo is seen only by the operator and deleted on approval", async ({ page, browser }) => {
  await signup(page, `verify-${Date.now()}@example.com`);
  await page.goto("/account/verify");
  await fill(page, { schoolName: "홍익대학교", department: "회화과" });
  await page.getByRole("button", { name: /학생증, 증명서/ }).click();
  await page.locator('[name="document"]').setInputFiles("e2e/fixtures/artwork.png");
  await page.locator('[name="agree"]').check();
  await page.getByRole("button", { name: "인증 신청" }).click();
  await expect(page.getByText("확인 중이에요")).toBeVisible();

  const admin = await browser.newPage();
  await admin.setExtraHTTPHeaders({ "x-real-ip": "10.77.0.2" });
  await adminLogin(admin);
  await admin.goto("/admin/verifications");
  const item = admin.locator("li", { hasText: "테스트회원" }).first();
  const img = item.getByRole("img", { name: "제출한 학생증이나 증명서" });
  const docUrl = await img.getAttribute("src");
  expect((await admin.request.get(docUrl!)).status()).toBe(200);
  // 회원(관리자 아님)은 못 본다: 로그인 화면으로 보내거나 거절하고, 사진은 오지 않는다
  const asMember = await page.request.get(docUrl!, { maxRedirects: 0 });
  expect([307, 401]).toContain(asMember.status());
  expect(asMember.headers()["content-type"] ?? "").not.toMatch(/^image\//);
  await item.getByRole("button", { name: "승인" }).click();
  await expect(item.getByRole("button", { name: "승인" })).toHaveCount(0); // 결정이 끝났다
  expect((await admin.request.get(docUrl!)).status()).toBe(404); // 승인과 함께 지워졌다

  await page.goto("/account/verify");
  await expect(page.getByText("MAYO 학교 인증")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("홍익대 인증");
  await admin.close();
});

/** 테스트 서버가 남긴 메일 중 받는 사람과 제목으로 마지막 것 */
async function lastMail(to: string, subject: RegExp) {
  const { readFile } = await import("node:fs/promises");
  for (let i = 0; i < 20; i++) {
    const lines = (await readFile(".data-e2e/outbox.jsonl", "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const hit = lines.map((l) => JSON.parse(l) as { to: string; subject: string; text: string }).reverse().find((m) => m.to === to && subject.test(m.subject));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no mail to ${to} matching ${subject}`);
}

test("forgot password: a one-time link resets the password and signs out everywhere", async ({ page }) => {
  const email = `reset-${Date.now()}@example.com`;
  await signup(page, email);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "로그인" })).toBeVisible();

  await page.goto("/login");
  await page.getByRole("link", { name: "비밀번호를 잊었나요?" }).click();
  await page.getByLabel("가입한 이메일").fill(email);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  await expect(page.getByText(/가입된 이메일이면 재설정 링크를 보냈어요/)).toBeVisible();
  // 없는 이메일에도 같은 답 (가입 여부를 알려 주지 않는다)
  await page.goto("/forgot-password");
  await page.getByLabel("가입한 이메일").fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  await expect(page.getByText(/가입된 이메일이면 재설정 링크를 보냈어요/)).toBeVisible();

  const mail = await lastMail(email, /비밀번호 재설정/);
  const link = mail.text.match(/https?:\/\/\S+reset-password\?token=[\w-]+/)![0];
  const path = new URL(link).pathname + new URL(link).search;
  const next = "a brand new passphrase 2028";
  await page.goto(path);
  await page.locator('input[name="password"]:visible').fill(next);
  await page.locator('input[name="passwordConfirm"]:visible').fill(next);
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(page.getByText("비밀번호를 바꿨어요")).toBeVisible();
  await page.locator('input[name="email"]:visible').fill(email);
  await page.locator('input[name="password"]:visible').fill(next);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/account$/);

  // 같은 링크는 다시 쓸 수 없다
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.goto(path);
  await page.locator('input[name="password"]:visible').fill("yet another passphrase 99");
  await page.locator('input[name="passwordConfirm"]:visible').fill("yet another passphrase 99");
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("만료됐거나 이미 쓰였어요");
});

test("school email verification sends a confirmation link the operator can see was clicked", async ({ page, browser }) => {
  await signup(page, `schoolmail-${Date.now()}@example.com`);
  await page.goto("/account/verify");
  await fill(page, { schoolName: "국민대학교", department: "금속공예학과", schoolEmail: "student@kookmin.ac.kr" });
  await page.locator('[name="agree"]').check();
  await page.getByRole("button", { name: "인증 신청" }).click();
  await expect(page.getByText(/student@kookmin.ac.kr로 보낸 확인 메일/)).toBeVisible();

  const mail = await lastMail("student@kookmin.ac.kr", /학교 이메일 확인/);
  const link = mail.text.match(/https?:\/\/\S+verify-email\?token=[\w-]+/)![0];
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByText("학교 이메일을 확인했어요")).toBeVisible();

  const admin = await browser.newPage();
  await admin.setExtraHTTPHeaders({ "x-real-ip": "10.77.0.3" });
  await adminLogin(admin);
  await admin.goto("/admin/verifications");
  await expect(admin.locator("li", { hasText: "student@kookmin.ac.kr" }).getByText(/메일 확인됨/)).toBeVisible();
  await admin.close();
});
