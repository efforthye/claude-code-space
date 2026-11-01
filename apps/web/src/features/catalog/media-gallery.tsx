"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/lib/domain/types";
import { WorkImage } from "./work-image";

/**
 * 작품 미디어 뷰어: 사진, 영상, 3D(GLB). 썸네일, 좌우 버튼, 키보드 ←/→ 로 넘긴다.
 * 사진은 원래 비율 그대로 보여 주고, 누르면 전체 화면 뷰어(확대, 이동, 넘기기)가 열린다.
 * 3D는 @google/model-viewer, 드래그로 회전, 휠, 핀치로 확대, 휴대폰에선 AR로 내 공간에 놓아 본다.
 */
export function MediaGallery({
  media,
  title,
}: {
  media: MediaItem[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null); // 열린 사진의 media 인덱스
  const count = media.length;
  const go = useCallback(
    (d: number) => setActive((i) => (i + d + count) % count),
    [count],
  );
  const current = media[active];
  const hasModel = media.some((m) => m.kind === "model");

  useEffect(() => {
    if (hasModel) import("@google/model-viewer");
  }, [hasModel]);

  if (!current) return <div className="aspect-[4/5] rounded-lg bg-white/60" />;
  const alt = current.alt ?? `${title} ${active + 1}`;

  return (
    <div
      className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24 lg:self-start"
      onKeyDown={(e) =>
        e.key === "ArrowRight" ? go(1) : e.key === "ArrowLeft" ? go(-1) : null
      }
    >
      <div
        // 무대 높이를 고정해 사진 비율이 바뀌어도 좌우 버튼은 같은 자리에 있다
        className="group relative flex h-[min(62vh,520px)] lg:h-[min(76vh,720px)] items-center justify-center"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} 미디어`}
        tabIndex={0}
      >
        {current.kind === "image" && (
          <button
            key={current.src}
            type="button"
            onClick={() => setViewer(active)}
            aria-label={`${alt} 크게 보기`}
            className="relative block animate-[rise_300ms_ease-out] cursor-zoom-in overflow-hidden rounded-lg shadow-[0_24px_60px_-28px_rgb(29_21_48/0.45)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={alt}
              draggable={false}
              className="block max-h-[min(62vh,520px)] lg:max-h-[min(76vh,720px)] w-auto max-w-full"
            />
            <span className="glass pointer-events-none absolute top-3 right-3 flex size-9 items-center justify-center rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <ExpandIcon />
            </span>
          </button>
        )}
        {current.kind === "video" && (
          <video
            key={current.src}
            src={current.src}
            poster={current.poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="block max-h-[min(62vh,520px)] lg:max-h-[min(76vh,720px)] w-auto max-w-full rounded-lg bg-black"
          >
            <track kind="captions" />
          </video>
        )}
        {current.kind === "model" && (
          <div className="glass relative aspect-square h-full max-w-full overflow-hidden rounded-lg">
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
              style={{
                width: "100%",
                height: "100%",
                background: "transparent",
              }}
            />
            <span className="glass pointer-events-none absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold">
              드래그해서 돌려 보세요
            </span>
          </div>
        )}
        {count > 1 && (
          <>
            <NavButton dir="left" onClick={() => go(-1)} className="left-3" />
            <NavButton dir="right" onClick={() => go(1)} className="right-3" />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Counter index={active} count={count} />
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
                  "relative size-18 shrink-0 overflow-hidden rounded-[14px] border-2 transition-[opacity,border-color,box-shadow] duration-200",
                  i === active
                    ? "border-violet shadow-md"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <WorkImage
                  src={m.kind === "image" ? m.src : (m.poster ?? undefined)}
                  alt=""
                  className="size-full"
                />
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

      {viewer != null &&
        createPortal(
          <Lightbox
            media={media}
            start={viewer}
            title={title}
            onClose={(last) => {
              setViewer(null);
              setActive(last); // 뷰어에서 넘긴 사진이 본 화면에도 남는다
            }}
          />,
          document.body, // 고정 헤더, sticky 열보다 위에 뜨도록 문서 맨 위로
        )}
    </div>
  );
}

/**
 * 전체 화면 사진 뷰어. 누르면 그 자리를 2.5배로 확대하고, 확대한 채로 움직이면 따라 이동한다.
 * ←/→, 스와이프로 넘기고 Esc로 닫는다. 사진만 넘긴다(영상, 3D는 본 화면에서).
 */
function Lightbox({
  media,
  start,
  title,
  onClose,
}: {
  media: MediaItem[];
  start: number;
  title: string;
  onClose: (index: number) => void;
}) {
  const photos = media
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.kind === "image");
  const [pos, setPos] = useState(
    Math.max(
      0,
      photos.findIndex((p) => p.i === start),
    ),
  );
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; moved: boolean } | null>(null);
  const n = photos.length;
  const photo = photos[pos];
  const close = useCallback(() => onClose(photo.i), [onClose, photo.i]);
  const step = useCallback(
    (d: number) => {
      setZoomed(false);
      setPos((p) => (p + d + n) % n);
    },
    [n],
  );

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && n > 1) step(1);
      else if (e.key === "ArrowLeft" && n > 1) step(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, step, n]);

  const pointAt = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(
      100,
      Math.max(0, ((e.clientX - r.left) / r.width) * 100),
    );
    const y = Math.min(
      100,
      Math.max(0, ((e.clientY - r.top) / r.height) * 100),
    );
    return `${x}% ${y}%`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 사진 크게 보기`}
      className="fixed inset-0 z-[60] flex animate-[rise_200ms_ease-out] flex-col bg-[#120d1f]/95 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold tabular-nums">
          {pos + 1} / {n}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="닫기"
          className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/15"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4"
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div
          className={cn(
            "relative max-h-full max-w-full touch-none overflow-hidden",
            zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
          )}
          onPointerDown={(e) =>
            (swipe.current = { x: e.clientX, moved: false })
          }
          onPointerMove={(e) => {
            if (swipe.current && Math.abs(e.clientX - swipe.current.x) > 8)
              swipe.current.moved = true;
            if (zoomed) setOrigin(pointAt(e));
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (!zoomed && s.moved && Math.abs(dx) > 50 && n > 1)
              return step(dx < 0 ? 1 : -1);
            if (s.moved && !zoomed) return;
            setOrigin(pointAt(e));
            setZoomed((z) => !z);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.m.src}
            src={photo.m.src}
            alt={photo.m.alt ?? `${title} ${photo.i + 1}`}
            draggable={false}
            className="block max-h-[calc(100dvh-9rem)] max-w-[min(92vw,1400px)] object-contain transition-[scale] duration-300 ease-out select-none"
            style={{ scale: zoomed ? "2.5" : "1", transformOrigin: origin }}
          />
        </div>
        {n > 1 && (
          <>
            <NavButton
              dir="left"
              onClick={() => step(-1)}
              className="left-4"
              dark
            />
            <NavButton
              dir="right"
              onClick={() => step(1)}
              className="right-4"
              dark
            />
          </>
        )}
      </div>
      <p className="pb-4 text-center text-xs text-white/70">
        {zoomed
          ? "움직여서 살펴보고, 다시 누르면 원래 크기"
          : "누르면 확대돼요"}
      </p>
    </div>
  );
}

function Counter({
  index,
  count,
  className,
}: {
  index: number;
  count: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute rounded-full bg-ink/55 px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums backdrop-blur",
        className,
      )}
    >
      {index + 1} / {count}
    </span>
  );
}

function NavButton({
  dir,
  onClick,
  className,
  dark,
}: {
  dir: "left" | "right";
  onClick: () => void;
  className?: string;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "이전" : "다음"}
      className={cn(
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-200",
        dark
          ? "bg-white/10 text-white hover:bg-white/25"
          : "glass hover:bg-white",
        className,
      )}
    >
      <Chevron dir={dir} />
    </button>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={
          dir === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"
        }
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5h4.5V8M8 16.5H3.5V12M16.5 3.5 11 9M3.5 16.5 9 11" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-5"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5 5 15" />
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
