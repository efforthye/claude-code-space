import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * E2E는 자기 dev 서버를 따로 띄운다: 데이터(.data-e2e)와 빌드 폴더(.next-e2e)를
 * 평소 개발용과 분리해서, 테스트가 개발 데이터를 건드리지 않게 한다.
 * 브라우저는 시스템 Chrome(channel: "chrome")을 쓴다 — 별도 다운로드 없음.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // 같은 데이터 파일을 공유하므로 순서대로
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: {
    command: `rm -rf .data-e2e && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MAYO_DATA_DIR: ".data-e2e",
      MAYO_MAIL_OUTBOX: ".data-e2e/outbox.jsonl",
      NEXT_DIST_DIR: ".next-e2e",
      ADMIN_PASSWORD: "e2e-admin-password",
      ADMIN_SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
      BANK_NAME: "테스트은행",
      BANK_ACCOUNT_NUMBER: "000-0000-0000",
      BANK_ACCOUNT_HOLDER: "크레이프",
    },
  },
});
