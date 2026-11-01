import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * 보안 헤더. CSP는 Next의 인라인 부트스트랩 때문에 script-src에 'unsafe-inline'이 필요하다
 * (nonce 방식으로 바꾸면 모든 페이지가 동적 렌더링이 되어 캐시를 잃는다).
 * 외부는 우편번호 서비스(daumcdn·postcode.map.daum.net)와 Unsplash 샘플 이미지만 허용.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://t1.daumcdn.net https://*.daumcdn.net${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.daumcdn.net",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src https://postcode.map.daum.net https://*.daum.net",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // e2e 테스트용 dev 서버가 평소 dev 서버와 빌드 폴더를 나눠 쓰도록
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 관리자 작품 등록에서 사진 여러 장을 한 번에 올린다(장당 10MB 상한은 uploads.ts에서 다시 검사).
    // Vercel 함수 요청 본문 상한(4.5MB)은 별개라, 실서비스 업로드는 스토리지 직접 업로드로 바꿔야 한다.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
