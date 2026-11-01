"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * 작품 사진 확대:
 * - 마우스를 올리면 커서 자리를 2.2배로 보여 준다 (터치 기기는 건너뜀)
 * - 누르면 전체 화면으로 열리고, 다시 누르면 2.5배 확대 + 커서/손가락을 따라 이동, Esc로 닫기
 */
export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        onPointerLeave={() => setOrigin(null)}
        aria-label={`${alt} 크게 보기`}
        className="relative flex max-h-full cursor-zoom-in overflow-hidden rounded-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[min(70vh,640px)] w-auto max-w-full object-contain transition-[translate,rotate,scale,transform] duration-300 ease-out"
          style={origin ? { transform: "scale(2.2)", transformOrigin: origin } : undefined}
        />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${alt} 크게 보기`} className="fixed inset-0 z-[60] flex animate-[rise_250ms_ease-out] items-center justify-center bg-ink/85 p-4 backdrop-blur-md">
      <button ref={closeRef} type="button" onClick={onClose} className="glass absolute top-4 right-4 z-10 rounded-full px-4 py-2 text-sm font-semibold">
        닫기
      </button>
      <div
        className={cn("relative max-h-full max-w-full overflow-hidden rounded-md", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
        onClick={() => setZoomed((z) => !z)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[90vh] max-w-[92vw] object-contain transition-[translate,rotate,scale,transform] duration-300 ease-out select-none"
          style={{ transform: zoomed ? "scale(2.5)" : "scale(1)", transformOrigin: origin }}
        />
      </div>
      <p className="absolute bottom-5 text-xs text-white/80">{zoomed ? "움직여서 살펴보고, 다시 누르면 원래 크기" : "누르면 확대돼요"}</p>
    </div>
  );
}
