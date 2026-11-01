import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${inter.variable} ${instrument.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
