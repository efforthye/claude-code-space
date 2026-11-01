"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { upload } from "./media-manager";

/** 작가 프로필 사진: 올리면 hidden `avatar`에 주소가 실린다. 서버에서 다시 검증. */
export function AvatarField({ initial, name }: { initial: string | null; name: string }) {
  const [src, setSrc] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const item = await upload(file, () => {});
      if (item.kind !== "image") throw new Error("사진 파일만 올릴 수 있어요");
      setSrc(item.src);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4 md:col-span-2">
      <input type="hidden" name="avatar" value={src ?? ""} />
      <Avatar src={src} name={name || "작가"} className="size-20 text-[48px]" />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">프로필 사진</span>
        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold transition-colors hover:bg-mist">
            {busy ? "올리는 중…" : src ? "바꾸기" : "올리기"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {src && <Button type="button" size="sm" variant="ghost" onClick={() => setSrc(null)}>빼기</Button>}
        </div>
        {error && <span className="text-xs text-dot">{error}</span>}
      </div>
    </div>
  );
}
