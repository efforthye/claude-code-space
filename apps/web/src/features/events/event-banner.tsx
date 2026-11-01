import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";

/** 홈 이벤트 배너 — 지금은 퍼스트 컬렉션 하나. 관리자 등록형 캐러셀로 바꿀 자리. */
export function EventBanner() {
  return (
    <Link
      href="/events/first-collection"
      className="group relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-lg px-7 py-8 text-white transition-transform duration-300 hover:-translate-y-0.5 sm:px-10"
      style={{ background: "linear-gradient(110deg, #1d1530 0%, #3a1f7a 45%, #ff5fa2 85%, #ff9d4d 100%)" }}
    >
      <span aria-hidden className="absolute -top-20 -right-16 size-72 rounded-full bg-white/12 transition-transform duration-700 group-hover:scale-110" />
      <span aria-hidden className="absolute -bottom-24 left-1/3 size-56 rounded-full bg-white/8" />
      <div className="relative flex flex-col gap-2">
        <Eyebrow tone="dark">Event</Eyebrow>
        <span className="font-display text-4xl leading-none sm:text-5xl">The First Collection</span>
        <span className="text-[15px] text-white/90">졸업작품 3점, MAYO가 직접 소장합니다</span>
      </div>
      <span className="relative inline-flex h-12 items-center rounded-full bg-white px-6 font-semibold text-ink transition-transform group-hover:translate-x-1">
        Enter →
      </span>
    </Link>
  );
}
