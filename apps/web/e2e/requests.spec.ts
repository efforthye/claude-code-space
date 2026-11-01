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

  await fill(page, { name: "새작가", birthYear: "2000", schoolName: "서울대학교", department: "조소과" });
  await page.getByRole("button", { name: "입점 신청하기" }).click();
  await expect(page.getByText("MAYO 작가가 되는 첫 걸음!")).toBeVisible();
  const code = (await page.locator("button", { hasText: /^J-/ }).innerText()).split("\n")[0].replace(/복사.*/, "").trim();

  await page.goto("/my");
  await expect(page.getByText("검토 대기 중")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/applications");
  await page.getByRole("button", { name: "승인하고 작가 만들기" }).first().click();
  await expect(page).toHaveURL(/\/admin\/artists\//);

  await page.goto("/my");
  await expect(page.locator("li", { hasText: code })).toContainText("승인됨");
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
  await page.locator('[name="agreePrivacy"]').check();
  await page.getByRole("button", { name: "전시 등록 신청하기" }).click();
  await expect(page.getByText("졸업 전시, 온라인에서도 오래 걸어 둘게요")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/exhibition-requests");
  await page.getByRole("button", { name: "승인하고 전시 만들기" }).first().click();
  await expect(page).toHaveURL(/\/admin\/exhibitions\/exh-/);
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.goto(`/exhibitions/${id}`);
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
  await expect(page.getByText("문의를 잘 받았어요")).toBeVisible();

  await adminLogin(page);
  await page.goto("/admin/inquiries");
  await page.locator("li", { hasText: "배송 문의" }).locator('[name="answer"]').fill("네, 전문 운송으로 지방도 가능해요.");
  await page.locator("li", { hasText: "배송 문의" }).getByRole("button", { name: "답변 보내기" }).click();
  await expect(page.locator("li", { hasText: "배송 문의" })).toContainText("답변 완료");

  await page.goto("/my");
  await expect(page.getByText("MAYO 답변: 네, 전문 운송으로 지방도 가능해요.")).toBeVisible();
});
