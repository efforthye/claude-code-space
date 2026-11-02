import { expect, test } from "@playwright/test";
import { adminLogin, fill } from "./helpers";

test("artist application: age rules, celebration, status, approval", async ({ page }) => {
  await page.goto("/join");
  await fill(page, { name: "어린작가", email: "kid@example.com", phone: "010-3333-4444", schoolName: "서울예고", birthYear: "2015" });
  await page.locator('[name="agreePrivacy"]').check();
  await page.locator('[name="agreeImage"]').check();
  await page.getByRole("button", { name: "입점 신청하기" }).click();
  await expect(page.getByText("만 14세 미만은 입점 신청을 받지 않아요")).toBeVisible();

  await fill(page, { birthYear: "2009" }); // possibly 16 → guardian needed
  await page.getByRole("button", { name: "입점 신청하기" }).click();
  await expect(page.getByText("만 19세 미만은 보호자 정보와 동의가 필요해요")).toBeVisible();

  await fill(page, { name: "김본명", artistName: "조각하는새", birthYear: "2000", schoolName: "서울대학교", department: "조소과" });
  await page.getByRole("button", { name: "입점 신청하기" }).click();
  await expect(page.getByText("입점 신청이 접수됐어요")).toBeVisible();
  const code = (await page.locator("button", { hasText: /^J-/ }).innerText()).split("\n")[0].replace(/복사.*/, "").trim();

  await page.goto("/my");
  await expect(page.getByText("검토 대기 중")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/applications");
  await page.getByRole("button", { name: "승인하고 작가 만들기" }).first().click();
  await expect(page).toHaveURL(/\/admin\/artists\//);

  await expect(page.getByLabel("작가명")).toHaveValue("조각하는새");
  await expect(page.getByLabel("본명")).toHaveValue("김본명");

  await page.goto("/my");
  await expect(page.locator("li", { hasText: code })).toContainText("승인됨");

  // 공개 화면에는 작가명만, 본명은 HTML 어디에도 없다
  const res = await page.request.get("/artists");
  const html = await res.text();
  expect(html).toContain("조각하는새");
  expect(html).not.toContain("김본명");
});

test("exhibition request picks the venue from place search and becomes an exhibition", async ({ page }) => {
  await page.route("**/api/places?**", (route) =>
    route.fulfill({
      json: { places: [{ name: "홍익대학교 홍문관", address: "서울 마포구 와우산로 94", category: "대학교", lat: 37.55, lng: 126.92, url: "https://place.map.kakao.com/1" }] },
    }),
  );
  await page.goto("/exhibitions/apply");
  await fill(page, { contactName: "졸준위", email: "c@example.com", phone: "010-7777-8888", schoolName: "홍익대학교", title: "E2E 졸업전시", startDate: "2026-12-01", endDate: "2026-12-05" });
  await page.getByPlaceholder(/장소 이름으로 검색/).fill("홍문관");
  await page.getByRole("button", { name: /홍익대학교 홍문관/ }).click();
  await page.getByPlaceholder(/상세 위치/).fill("7층");
  await page.locator('textarea[name="description"]').fill("네 개의 전공이 함께 여는 졸업전시입니다.");
  await fill(page, { instagram: "@e2e_gradshow", artistCount: "31" });
  await page.locator('[name="poster"]').setInputFiles("e2e/fixtures/artwork.png");
  await page.locator('[name="agreePrivacy"]').check();
  // 포스터를 올렸으면 게시 동의가 있어야 받는다
  await page.getByRole("button", { name: "전시 등록 신청하기" }).click();
  await expect(page.getByText("포스터 게시 동의에 체크해 주세요")).toBeVisible();
  await page.locator('[name="poster"]').setInputFiles("e2e/fixtures/artwork.png"); // React가 폼을 다시 그리며 비운 경우 대비
  await page.locator('[name="agreePoster"]').check();
  await page.getByRole("button", { name: "전시 등록 신청하기" }).click();
  await expect(page.getByText("전시 등록 신청이 접수됐어요")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/exhibition-requests");
  await page.getByRole("button", { name: "승인하고 전시 만들기" }).first().click();
  await expect(page).toHaveURL(/\/admin\/exhibitions\/exh-/);
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.goto(`/exhibitions/${id}`);
  await expect(page.getByRole("img", { name: "E2E 졸업전시 포스터" })).toBeVisible();
  await expect(page.getByText("네 개의 전공이 함께 여는 졸업전시입니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "@e2e_gradshow" })).toBeVisible();
  await expect(page.getByText("31명 참여")).toBeVisible();
  await expect(page.getByText("홍익대학교 홍문관 7층")).toBeVisible();
  await expect(page.getByText("서울 마포구 와우산로 94")).toBeVisible();
  await expect(page.getByRole("link", { name: /카카오맵/ })).toHaveAttribute("href", "https://place.map.kakao.com/1");
  await expect(page.getByRole("link", { name: /네이버 지도/ })).toHaveAttribute("href", /map\.naver\.com\/p\/search\//);
});

test("without a Kakao key the venue picker offers the postcode finder", async ({ page }) => {
  await page.goto("/exhibitions/apply");
  await page.getByPlaceholder(/장소 이름으로 검색/).fill("홍문관");
  await expect(page.getByRole("button", { name: "건물이나 주소로 검색" })).toBeVisible();
});

test("inquiry gets an admin answer that shows up in 내 신청 현황", async ({ page }) => {
  await page.goto("/contact");
  await fill(page, { name: "문의자", email: "q@example.com", subject: "배송 문의", message: "가구 작품도 지방으로 배송되나요?" });
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "문의 보내기" }).click();
  await expect(page.getByText("문의가 접수됐어요")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/inquiries");
  await page.locator("li", { hasText: "배송 문의" }).locator('[name="answer"]').fill("네, 전문 운송으로 지방도 가능해요.");
  await page.locator("li", { hasText: "배송 문의" }).getByRole("button", { name: "답변 보내기" }).click();
  await expect(page.locator("li", { hasText: "배송 문의" })).toContainText("답변 완료");

  await page.goto("/my");
  await expect(page.getByText("MAYO 답변: 네, 전문 운송으로 지방도 가능해요.")).toBeVisible();
});
