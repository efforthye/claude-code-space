import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e 테스트용 dev 서버가 평소 dev 서버와 빌드 폴더를 나눠 쓰도록
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  experimental: {
    // 관리자 작품 등록에서 사진 여러 장(장당 10MB)을 한 번에 올린다.
    // Vercel 함수 요청 본문 상한(4.5MB)은 별개라, 실서비스 업로드는 스토리지 직접 업로드로 바꿔야 한다.
    serverActions: { bodySizeLimit: "25mb" },
  },
  partialPrefetching: true,
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
