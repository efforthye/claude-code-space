"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { upload } from "./media-manager";

/** 사진 한 장 필드 (전시 포스터 등). 올리면 hidden 입력에 주소가 실리고, 서버에서 다시 검증한다. */
export function ImageField({ name, label, initial, className, endpoint }: { name: string; label: string; initial: string | null; className?: string; endpoint?: string }) {
  const [src, setSrc] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const item = await upload(file, () => {}, endpoint);
      if (item.kind !== "image") throw new Error("사진 파일만 올릴 수 있어요");
      setSrc(item.src);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className={className}>
      <input type="hidden" name={name} value={src ?? ""} />
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <div className="flex items-end gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" className="h-32 w-auto rounded-md object-contain" /> : <div className="flex h-32 w-24 items-center justify-center rounded-md border border-dashed border-ink/20 text-xs text-ink-soft">없음</div>}
        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold transition-colors hover:bg-mist">
            {busy ? "올리는 중…" : src ? "바꾸기" : "올리기"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {src && <Button type="button" size="sm" variant="ghost" onClick={() => setSrc(null)}>빼기</Button>}
        </div>
      </div>
      {error && <span className="mt-1 block text-xs text-dot">{error}</span>}
    </div>
  );
}
