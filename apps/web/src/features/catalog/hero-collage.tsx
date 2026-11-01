"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SealIcon } from "@/components/ui/verified-badge";
import { cn } from "@/lib/cn";
import { WorkImage } from "./work-image";

export type HeroWork = {
  id: string;
  title: string;
  cover: string | undefined;
  medium: string;
  artist: string;
  verifiedSchool: string | null;
  price: string;
};

/** 두 열 에디토리얼 배치: [열][카드] 비율. 열은 위아래로 엇갈린다. */
const LAYOUT = [
  ["aspect-[4/5]", "aspect-square"],
  ["aspect-square", "aspect-[4/5]"],
];

/** 등록 작품이 아직 없을 때(실서비스 오픈 전) 보여 줄 장식용 사진 */
const DECOR: HeroWork[] = ["painting-red-blue", "chair-floor", "sculpture-bust", "bowl-brass"].map((name) => ({
  id: name,
  title: "",
  cover: `/samples/photos/${name}.jpg`,
  medium: "",
  artist: "",
  verifiedSchool: null,
  price: "",
}));

/**
 * 히어로 작품 스택: 앞의 한 점이 크게, 뒤의 두 점이 양옆으로 비친다.
 * 4.5초마다 넘어가고(마우스를 올리면 멈춤), 뒤 카드를 누르면 앞으로 온다.
 */
/** 피셔–예이츠 셔플 후 앞에서 k개 */
function pick<T>(xs: T[], k: number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

export function HeroCollage({ works }: { works: HeroWork[] }) {
  const decorative = works.length === 0;
  // 홈은 서버에서 캐시되므로, 판매 중인 작품 중 4점은 방문할 때마다 브라우저에서 무작위로 고른다
  const [picked, setPicked] = useState<HeroWork[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(pick(works, 4));
  }, [works]);
  const items = decorative ? DECOR : (picked ?? works.slice(0, 4));
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (paused || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setFront((f) => (f + 1) % n), 4500);
    return () => clearInterval(t);
  }, [paused, n]);

  const lead = items[front] ?? items[0];
  const columns = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)];

  return (
    <div
      className={cn(
        "relative isolate transition-opacity duration-700",
        !decorative && !picked ? "opacity-0" : "opacity-100",
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-hidden={decorative || undefined}
    >
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {columns.map((col, c) => (
          <div key={c} className={cn("flex flex-col gap-4 sm:gap-5", c === 0 ? "pt-10 sm:pt-16" : "pb-10 sm:pb-16")}>
            {col.map((w, r) => {
              const i = c + r * 2;
              const active = !decorative && i === front;
              const tile = (
                <div
                  className={cn(
                    "glass overflow-hidden rounded-[24px] p-2 transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
                    active && "-translate-y-1.5 shadow-[0_28px_50px_-22px_rgb(60_30_120/0.55)]",
                  )}
                >
                  <WorkImage src={w.cover} alt={w.title} className={cn("w-full rounded-[18px]", LAYOUT[c][r] ?? "aspect-square")} />
                </div>
              );
              return decorative ? (
                <div key={w.id}>{tile}</div>
              ) : (
                <Link
                  key={w.id}
                  href={`/works/${w.id}`}
                  onMouseEnter={() => setFront(i)}
                  onFocus={() => setFront(i)}
                  aria-label={`${w.title} 보기`}
                  className="block"
                >
                  {tile}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {!decorative && lead && (
        <div className="glass absolute bottom-0 left-1/2 z-10 w-[min(92%,380px)] -translate-x-1/2 translate-y-1/3 rounded-[20px] px-5 py-4" aria-live="polite">
          <div key={lead.id} className="flex animate-[rise_450ms_cubic-bezier(.22,1,.36,1)] items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              {lead.verifiedSchool && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-violet">
                  <SealIcon className="size-4" />
                  {lead.verifiedSchool} 학교 인증
                </span>
              )}
              <span className="truncate font-semibold">{lead.title}</span>
              <span className="text-[13px] text-ink-soft">{lead.artist}</span>
            </div>
            <span className="shrink-0 font-semibold">{lead.price}</span>
          </div>
        </div>
      )}
    </div>
  );
}
