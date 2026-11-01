"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/lib/domain/types";
import { WorkImage } from "./work-image";
import { ZoomImage } from "./zoom-image";

/**
 * 작품 미디어 뷰어: 사진, 영상, 3D(GLB). 썸네일, 좌우 버튼, 키보드 ←/→ 로 넘긴다.
 * 3D는 @google/model-viewer — 드래그로 회전, 휠, 핀치로 확대, 휴대폰에선 AR로 내 공간에 놓아 본다.
 */
export function MediaGallery({ media, title }: { media: MediaItem[]; title: string }) {
  const [active, setActive] = useState(0);
  const count = media.length;
  const go = useCallback((d: number) => setActive((i) => (i + d + count) % count), [count]);
  const current = media[active];
  const hasModel = media.some((m) => m.kind === "model");

  useEffect(() => {
    if (hasModel) import("@google/model-viewer");
  }, [hasModel]);

  if (!current) return <div className="aspect-[4/5] rounded-lg bg-white/60" />;

  return (
    <div className="flex flex-col gap-3" onKeyDown={(e) => (e.key === "ArrowRight" ? go(1) : e.key === "ArrowLeft" ? go(-1) : null)}>
      <div className="glass relative overflow-hidden rounded-lg p-3 sm:p-5" role="region" aria-roledescription="carousel" aria-label={`${title} 미디어`} tabIndex={0}>
        <div className="flex h-[min(70vh,640px)] items-center justify-center">
          {current.kind === "image" && (
            <div key={current.src} className="flex max-h-full animate-[rise_300ms_ease-out] justify-center">
              <ZoomImage src={current.src} alt={current.alt ?? `${title} ${active + 1}`} />
            </div>
          )}
          {current.kind === "video" && (
            <video key={current.src} src={current.src} poster={current.poster ?? undefined} controls playsInline preload="metadata" className="max-h-full max-w-full rounded-md bg-black">
              <track kind="captions" />
            </video>
          )}
          {current.kind === "model" && (
            <model-viewer
              key={current.src}
              src={current.src}
              poster={current.poster ?? undefined}
              alt={current.alt ?? `${title} 3D 모델`}
              camera-controls
              auto-rotate
              ar
              touch-action="pan-y"
              shadow-intensity="1"
              style={{ width: "100%", height: "100%", background: "transparent" }}
            />
          )}
        </div>
        {current.kind === "model" && (
          <span className="glass pointer-events-none absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold">
            드래그해서 돌려 보세요
          </span>
        )}
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="이전" className="glass absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-white">
              <Chevron dir="left" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="다음" className="glass absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-white">
              <Chevron dir="right" />
            </button>
            <span className="glass absolute right-4 bottom-4 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto p-1">
          {media.map((m, i) => (
            <button
              key={m.src + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${i + 1}번째 ${m.kind === "image" ? "사진" : m.kind === "video" ? "영상" : "3D 모델"} 보기`}
              aria-current={i === active}
              className={cn(
                "relative size-18 shrink-0 overflow-hidden rounded-[14px] border-2 transition",
                i === active ? "border-violet shadow-md" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <WorkImage src={m.kind === "image" ? m.src : (m.poster ?? undefined)} alt="" className="size-full" />
              {m.kind !== "image" && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/35 text-[11px] font-bold text-white">
                  {m.kind === "video" ? <PlayIcon /> : "3D"}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" aria-hidden fill="currentColor">
      <path d="M6 4.5v11l9-5.5z" />
    </svg>
  );
}
