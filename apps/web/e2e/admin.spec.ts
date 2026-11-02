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

test("admin registers a work with a photo, a video and a 3D model", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/works/new");
  await page.locator('[name="title"]').fill("E2E 조각");
  await page.locator('[name="artistId"]').selectOption({ label: "최서준" });
  await page.locator('[name="medium"]').selectOption("sculpture");
  for (const [n, v] of [["materials", "청동"], ["widthCm", "30"], ["heightCm", "50"], ["price", "500000"]]) await page.locator(`[name="${n}"]`).fill(v);
  await page.getByLabel("미디어 파일").setInputFiles(["e2e/fixtures/artwork.png", "e2e/fixtures/clip.mp4", "e2e/fixtures/model.glb"]);
  await expect(page.getByRole("list", { name: "미디어 순서" }).locator("li")).toHaveCount(3);
  await page.getByRole("button", { name: "작품 등록" }).click();
  await expect(page.getByText("저장했어요")).toBeVisible();
  const workId = new URL(page.url()).pathname.split("/").pop();
  await page.goto(`/works/${workId}`);
  await expect(page.getByRole("heading", { name: "「E2E 조각」" })).toBeVisible();
  const src = await page.locator("main img").first().getAttribute("src");
  const img = await page.request.get(src!);
  expect(img.headers()["content-type"]).toBe("image/png");
  // 영상: 썸네일로 넘기면 플레이어가 뜨고, Range 요청에 206으로 답한다
  await page.getByRole("button", { name: /번째 영상 보기/ }).click();
  const videoSrc = await page.locator("main video").getAttribute("src");
  const part = await page.request.get(videoSrc!, { headers: { Range: "bytes=0-99" } });
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toMatch(/^bytes 0-99\//);
  // 3D: model-viewer 로 표시
  await page.getByRole("button", { name: /번째 3D 모델 보기/ }).click();
  // React 19는 커스텀 엘리먼트에 속성(property)으로 넘긴다, 실제 값을 확인
  await expect.poll(() => page.locator("main model-viewer").evaluate((el) => (el as HTMLElement & { src: string }).src)).toMatch(/\.glb$/);
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
  await page.getByLabel("미디어 파일").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)></svg>") });
  await expect(page.getByText(/사진\(JPG, PNG, WEBP, AVIF\), 영상\(MP4, WebM\), 3D\(GLB\)만/)).toBeVisible();
  await page.getByRole("button", { name: "작품 등록" }).click();
  await expect(page.getByText("대표 사진을 한 장 이상 올려 주세요")).toBeVisible();
});

test("ledger CSV neutralises formula injection", async ({ page }) => {
  const { adminLogin, placeOrder } = await import("./helpers");
  // 작품명에 수식을 넣은 작품을 만들어 판매까지 진행
  await adminLogin(page);
  await page.goto("/admin/works/new");
  await page.locator('[name="title"]').fill('=HYPERLINK("http://evil","x")');
  await page.locator('[name="artistId"]').selectOption({ label: "최서준" });
  for (const [n, v] of [["materials", "x"], ["widthCm", "10"], ["heightCm", "10"], ["price", "1000"]]) await page.locator(`[name="${n}"]`).fill(v);
  await page.getByLabel("미디어 파일").setInputFiles("e2e/fixtures/artwork.png");
  await expect(page.getByRole("list", { name: "미디어 순서" }).locator("li")).toHaveCount(1);
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

test("media upload API refuses anonymous and forged sessions", async ({ request }) => {
  const multipart = { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) } };
  expect((await request.post("/api/admin/media", { multipart })).status()).toBe(401);
  const forged = await request.post("/api/admin/media", { multipart, headers: { Cookie: "mayo_admin=9999999999.forged" } });
  expect(forged.status()).toBe(401);
});

test("admin renames, hides and reorders categories; the works filter follows", async ({ page }) => {
  const { adminLogin } = await import("./helpers");
  await adminLogin(page);
  await page.goto("/admin/categories");
  const row = page.locator("li", { has: page.getByLabel("ceramic 이름") });
  await row.getByLabel("ceramic 이름").fill("도자");
  await row.getByRole("button", { name: "저장" }).click();
  await expect(row.getByLabel("ceramic 이름")).toHaveValue("도자");
  const drawing = page.locator("li", { has: page.getByLabel("drawing 이름") });
  await drawing.getByLabel("보이기").uncheck();
  await drawing.getByRole("button", { name: "저장" }).click();
  await expect(drawing.getByLabel("보이기")).not.toBeChecked();
  await page.goto("/works");
  await expect(page.getByRole("button", { name: "도자", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "드로잉", exact: true })).toHaveCount(0);
  // 작품이 쓰는 분류는 삭제 버튼이 없다
  await page.goto("/admin/categories");
  await expect(page.locator("li", { has: page.getByLabel("painting 이름") }).getByRole("button", { name: "삭제" })).toHaveCount(0);
});

test("admin manages artist groups; the artist filter chips follow", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/artist-groups");
  const student = page.locator("li", { has: page.getByLabel("student 이름") });
  await student.getByLabel("student 이름").fill("재학 작가");
  await student.getByRole("button", { name: "저장" }).click();
  await expect(student.getByLabel("student 이름")).toHaveValue("재학 작가");
  const graduate = page.locator("li", { has: page.getByLabel("graduate 이름") });
  await graduate.getByLabel("필터에 보이기").uncheck();
  await graduate.getByRole("button", { name: "저장" }).click();
  await expect(graduate.getByLabel("필터에 보이기")).not.toBeChecked();
  // 새 구분을 만들고, 아무도 안 쓰니 지울 수 있다
  await page.getByLabel("코드").fill("master");
  await page.getByLabel("이름", { exact: true }).fill("원로 작가");
  await page.getByRole("button", { name: "구분 추가" }).click();
  const master = page.locator("li", { has: page.getByLabel("master 이름") });
  await expect(master).toBeVisible();
  await master.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByLabel("master 이름")).toHaveCount(0);
  // 작가가 쓰는 구분은 삭제 버튼이 없다
  await expect(student.getByRole("button", { name: "삭제" })).toHaveCount(0);

  await page.goto("/artists");
  await expect(page.getByRole("button", { name: "재학 작가", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "졸업생", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "작고 작가", exact: true })).toBeVisible();
});

test("a late artist's work names the estate as seller, with provenance", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/artists/art-late-oh");
  await expect(page.getByLabel("작고 연도")).toHaveValue("2011");
  // 작고 연도가 출생보다 빠르면 저장되지 않는다
  await page.getByLabel("출생 연도").fill("2020");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.getByText("작고 연도가 출생 연도보다 빨라요")).toBeVisible();

  await page.goto("/artists/art-late-oh");
  await expect(page.getByRole("heading", { name: /오명수/ })).toContainText("1938–2011");
  await expect(page.getByText(/작가 유족 측에서 판매/)).toBeVisible();
  await page.goto("/works/w-red-roofs");
  await expect(page.getByText("작가 유족").first()).toBeVisible();
  await expect(page.getByText(/1987–2011/)).toBeVisible();
  await expect(page.getByText("MAYO 학교 인증")).toHaveCount(0);
});

test("a buyer requests a certificate, the operator issues and revokes it, anyone can verify", async ({ page }) => {
  const code = await placeOrder(page, "w-red-roofs");
  // 입금 전에는 요청할 수 없다
  await expect(page.getByRole("button", { name: "작품 보증서 요청하기" })).toHaveCount(0);

  await adminLogin(page);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: code }).click();
  await page.waitForURL(/\/admin\/orders\/[^/]+$/);
  const orderUrl = page.url();
  await expect(page.getByText("판매자 작가 유족")).toBeVisible();
  await page.getByRole("button", { name: "입금 확인" }).click();
  await expect(page.getByRole("button", { name: "배송 준비 시작" })).toBeVisible();

  await page.goto(`/orders/${code}`);
  await page.getByRole("button", { name: "작품 보증서 요청하기" }).click();
  await expect(page.getByText("작품 보증서를 요청하셨어요")).toBeVisible();

  await page.goto(orderUrl);
  await expect(page.getByText(/구매자 요청/)).toBeVisible();
  await page.getByRole("button", { name: "작품 보증서 발급" }).click();
  const badge = page.getByText(/^보증서 C-/);
  await expect(badge).toBeVisible();
  const certCode = (await badge.textContent())!.replace("보증서 ", "");

  // 유통 내역에 2차 판매(위탁)와 보증서 번호가 남는다
  const csv = await (await page.request.get("/admin/ledger.csv")).text();
  expect(csv).toContain("2차 판매 (위탁)");
  expect(csv).toContain(certCode);

  await page.goto(`/orders/${code}`);
  await page.getByRole("link", { name: /작품 보증서 보기/ }).click();
  await expect(page.getByText("유효한 보증서")).toBeVisible();
  await expect(page.getByText("「붉은 지붕」").first()).toBeVisible();
  await expect(page.getByText("오명수 (1938–2011)")).toBeVisible();
  await expect(page.getByText("구*자")).toBeVisible(); // 구매자 이름은 가린다
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);

  await page.goto(orderUrl);
  await page.getByLabel(`${certCode} 취소 사유`).fill("주문 취소");
  await page.getByRole("button", { name: "보증서 취소" }).click();
  await expect(page.getByRole("button", { name: "작품 보증서 발급" })).toBeVisible();
  await page.goto(`/certificates/${certCode}`);
  await expect(page.getByText("취소된 보증서예요")).toBeVisible();
  await expect(page.getByText(/사유: 주문 취소/)).toBeVisible();
});

test("the compliance checklist is one click from the dashboard", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: /미술서비스업 신고가 아직이에요/ }).click();
  await expect(page.getByRole("heading", { name: "미술서비스업 신고" })).toBeVisible();
  await expect(page.getByText(/강남구보건소 5층 문화도시과/).first()).toBeVisible();
});

test("the logo mark is chosen in admin and the header, tab icon and manifest follow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "MAYO 홈" }).locator("[data-logo-mark]")).toHaveAttribute("data-logo-mark", "glass");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "/brand/glass/icon.svg");

  await adminLogin(page);
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /액자 속 그림/ }).click();
  await expect(page.getByRole("button", { name: /액자 속 그림/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "MAYO 홈" }).locator("[data-logo-mark]")).toHaveAttribute("data-logo-mark", "painting");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "/brand/painting/icon.svg");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.icons[0].src).toBe("/brand/painting/icon-192.png");

  // 기본값(스테인드글라스)으로 되돌린다
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /스테인드글라스/ }).click();
  await expect(page.getByRole("button", { name: /스테인드글라스/ })).toHaveAttribute("aria-pressed", "true");
});

test("an exhibition shows its countdown, official account, participants and related shows", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/exhibitions/exh-26f-hongik-wood");
  await page.getByLabel("공식 인스타그램").fill("@hongik_wood_2026");
  await page.getByLabel("참여 인원").fill("24");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(page).toHaveURL(/\/admin\/exhibitions$/);

  await page.goto("/exhibitions/exh-26f-hongik-wood");
  await expect(page.getByRole("link", { name: "@hongik_wood_2026" })).toHaveAttribute("href", "https://instagram.com/hongik_wood_2026");
  await expect(page.getByText("24명 참여")).toBeVisible();
  await expect(page.getByText(/일 뒤 시작|내일 시작|남았어요|오늘 마지막 날|내일까지/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "홍익대의 다른 전시" })).toBeVisible();
});
