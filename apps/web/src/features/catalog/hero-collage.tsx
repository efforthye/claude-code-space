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

/** 앞에서부터 뒤로: 가운데(앞) → 오른쪽 → 왼쪽 → 맨 뒤 */
const POSES = [
  { transform: "translateX(0) rotate(0deg) scale(1)", zIndex: 40, opacity: 1 },
  { transform: "translateX(34%) rotate(7deg) scale(0.84)", zIndex: 30, opacity: 0.95 },
  { transform: "translateX(-34%) rotate(-7deg) scale(0.84)", zIndex: 20, opacity: 0.95 },
  { transform: "translateX(0) rotate(0deg) scale(0.72)", zIndex: 10, opacity: 0 },
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

  const lead = items[front];

  return (
    <div
      className={cn(
        "relative isolate flex h-[460px] flex-col items-center justify-center transition-opacity duration-700 sm:h-[580px]",
        !decorative && !picked ? "opacity-0" : "opacity-100",
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-hidden={decorative || undefined}
    >
      <div className="relative aspect-[4/5] w-[62%] max-w-[360px]">
        {items.map((w, i) => {
          const pos = (i - front + n) % n;
          const pose = POSES[pos] ?? POSES[3];
          const card = (
            <div className="glass size-full rounded-[26px] p-2.5">
              <WorkImage src={w.cover} alt={w.title} className="size-full rounded-[18px]" />
            </div>
          );
          return (
            <div
              key={w.id}
              className="absolute inset-0 transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)]"
              style={{ transform: pose.transform, zIndex: pose.zIndex, opacity: pose.opacity }}
            >
              {decorative ? (
                card
              ) : pos === 0 ? (
                <Link href={`/works/${w.id}`} aria-label={`${w.title} 보기`} className="block size-full transition-[scale] duration-500 hover:scale-[1.02]">
                  {card}
                </Link>
              ) : (
                <button type="button" onClick={() => setFront(i)} aria-label={`${w.title} 앞으로`} tabIndex={pos < 3 ? 0 : -1} className="block size-full">
                  {card}
                </button>
              )}
            </div>
          );
        })}

        {!decorative && lead && (
          <div className="glass absolute -bottom-6 left-1/2 z-50 w-[118%] -translate-x-1/2 rounded-[20px] px-5 py-4" aria-live="polite">
            <div key={lead.id} className="flex animate-[rise_450ms_cubic-bezier(.22,1,.36,1)] items-end justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                {lead.verifiedSchool && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-violet">
                    <SealIcon className="size-4" />
                    {lead.verifiedSchool} 학교 인증
                  </span>
                )}
                <span className="truncate font-semibold">{lead.title}</span>
                <span className="text-[13px] text-ink-soft">
                  {lead.artist}, {lead.medium}
                </span>
              </div>
              <span className="shrink-0 font-semibold">{lead.price}</span>
            </div>
          </div>
        )}
      </div>

      {n > 1 && !decorative && (
        <div className="mt-14 flex gap-2" role="tablist" aria-label="대표 작품">
          {items.map((w, i) => (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={i === front}
              aria-label={`${i + 1}번째 작품`}
              onClick={() => setFront(i)}
              className={cn("h-2 rounded-full transition-[width,background-color] duration-500", i === front ? "bg-aurora w-6" : "w-2 bg-ink/20 hover:bg-ink/40")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
