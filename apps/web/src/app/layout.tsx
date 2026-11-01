import type { Metadata } from "next";
import { DM_Serif_Display, Instrument_Serif, Inter } from "next/font/google";
import localFont from "next/font/local";
import { getSiteSettings } from "@/lib/data/catalog";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// Latin UI + numbers. Korean falls through to Pretendard.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// English display headlines only.
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

// 로고의 "ayo"
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif", display: "swap" });

/** 아이콘은 관리자 설정의 로고 마크를 따른다 (public/brand/<mark>/…) */
export async function generateMetadata(): Promise<Metadata> {
  const { logoMark } = await getSiteSettings();
  return {
    ...metadata,
    icons: {
      // favicon.ico는 app/favicon.ico 파일 규칙이 따로 넣는다 (SVG를 못 읽는 브라우저용, 스테인드글라스)
      icon: { url: `/brand/${logoMark}/icon.svg`, type: "image/svg+xml" },
      apple: { url: `/brand/${logoMark}/apple-icon.png`, sizes: "180x180" },
    },
  };
}

const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}, ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${inter.variable} ${instrument.variable} ${dmSerif.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
