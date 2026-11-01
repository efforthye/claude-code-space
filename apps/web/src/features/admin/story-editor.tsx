"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { WorkImage } from "@/features/catalog/work-image";
import type { StoryBlock } from "@/lib/domain/types";
import { upload } from "./media-manager";

/**
 * 작품 이야기 편집: 글 칸과 사진 칸을 원하는 순서로 쌓는다.
 * 폼에는 hidden `story`(JSON)로 실리고, 서버에서 다시 검증한다.
 */
export function StoryEditor({
  initial,
  name = "story",
  legend = "작품 이야기 (작품 페이지 아래, 글과 사진을 순서대로)",
  empty = "작업 과정, 영감, 설치 모습처럼 더 들려주고 싶은 이야기를 넣어 보세요.",
}: {
  initial: StoryBlock[];
  name?: string;
  legend?: string;
  empty?: string;
}) {
  const [blocks, setBlocks] = useState<StoryBlock[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, b: StoryBlock) => setBlocks((xs) => xs.map((x, k) => (k === i ? b : x)));
  const move = (i: number, d: number) =>
    setBlocks((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function addImages(files: FileList | null) {
    setError(null);
    setBusy(true);
    for (const file of Array.from(files ?? [])) {
      try {
        const item = await upload(file, () => {});
        if (item.kind !== "image") throw new Error("작품 이야기에는 사진만 넣을 수 있어요");
        setBlocks((xs) => [...xs, { kind: "image", src: item.src, caption: null }]);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setBusy(false);
  }

  // 빈 글 칸은 저장하지 않는다
  const clean = blocks.filter((b) => b.kind === "image" || b.text.trim());

  return (
    <fieldset className="glass flex flex-col gap-4 rounded-lg p-4 md:col-span-2">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      <input type="hidden" name={name} value={JSON.stringify(clean)} />
      {blocks.length === 0 && <p className="text-sm text-ink-soft">{empty}</p>}
      <ol className="flex flex-col gap-3">
        {blocks.map((b, i) => (
          <li key={i} className="flex gap-3 rounded-md bg-white/70 p-3">
            <div className="flex flex-col gap-1">
              <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${i + 1}번째 칸 위로`}>↑</Button>
              <Button type="button" size="sm" variant="ghost" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={`${i + 1}번째 칸 아래로`}>↓</Button>
            </div>
            {b.kind === "text" ? (
              <Textarea aria-label={`${i + 1}번째 글`} value={b.text} onChange={(e) => set(i, { kind: "text", text: e.target.value })} className="min-h-28 flex-1" maxLength={3000} />
            ) : (
              <div className="flex flex-1 flex-wrap items-start gap-3">
                <WorkImage src={b.src} alt="" className="size-24 rounded-md" />
                <Input aria-label={`${i + 1}번째 사진 설명`} placeholder="사진 설명 (선택)" value={b.caption ?? ""} onChange={(e) => set(i, { ...b, caption: e.target.value || null })} className="min-w-48 flex-1" maxLength={200} />
              </div>
            )}
            <Button type="button" size="sm" variant="danger" onClick={() => setBlocks((xs) => xs.filter((_, k) => k !== i))} aria-label={`${i + 1}번째 칸 빼기`}>빼기</Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setBlocks((xs) => [...xs, { kind: "text", text: "" }])}>글 추가</Button>
        <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold transition-colors hover:bg-mist">
          {busy ? "올리는 중…" : "사진 추가"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" disabled={busy} onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {error && <p className="text-sm text-dot">{error}</p>}
    </fieldset>
  );
}
