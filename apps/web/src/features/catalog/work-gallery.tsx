"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { WorkImage } from "./work-image";

/** 다각도 사진: 썸네일을 눌러 넘겨 본다. */
export function WorkGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-paper p-4 sm:p-8">
        <WorkImage src={images[active]} alt={`${title} — ${active + 1}번째 사진`} className="mx-auto max-h-[70vh] w-full object-contain" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${i + 1}번째 사진 보기`}
              className={cn("size-16 overflow-hidden border-2 bg-paper transition-[opacity,border-color]", i === active ? "border-ink" : "border-transparent opacity-60 hover:border-line hover:opacity-100")}
            >
              <WorkImage src={src} alt="" className="size-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
