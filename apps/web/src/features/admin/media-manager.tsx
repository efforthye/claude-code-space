"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { WorkImage } from "@/features/catalog/work-image";
import type { MediaItem } from "@/lib/domain/types";

type Uploading = { id: string; name: string; progress: number; error?: string };

/** 한 파일씩 올린다 (진행률 표시를 위해 XHR). 관리자는 /api/admin/media, 회원은 /api/media(사진만). */
export function upload(
  file: File,
  onProgress: (p: number) => void,
  endpoint = "/api/admin/media",
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { error?: string } & Partial<MediaItem> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 201 && body.src && body.kind)
        resolve({ kind: body.kind, src: body.src });
      else reject(new Error(body.error ?? `업로드 실패 (${xhr.status})`));
    };
    xhr.onerror = () =>
      reject(new Error("네트워크 오류로 업로드하지 못했어요"));
    const fd = new FormData();
    fd.set("file", file);
    xhr.send(fd);
  });
}

const KIND_LABEL = { image: "사진", video: "영상", model: "3D" } as const;

/**
 * 작품 미디어 관리: 사진, 영상, 3D를 올리고 순서를 바꾸고 뺀다. 첫 번째 사진이 대표 이미지.
 * 폼에는 hidden `media`(JSON)로 실리고, 서버에서 다시 검증한다.
 */
export function MediaManager({
  initial,
  endpoint,
  imagesOnly = false,
}: {
  initial: MediaItem[];
  endpoint?: string;
  imagesOnly?: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [queue, setQueue] = useState<Uploading[]>([]);
  const [url, setUrl] = useState("");

  async function onFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const id = crypto.randomUUID();
      setQueue((q) => [...q, { id, name: file.name, progress: 0 }]);
      try {
        const item = await upload(
          file,
          (p) =>
            setQueue((q) =>
              q.map((u) => (u.id === id ? { ...u, progress: p } : u)),
            ),
          endpoint,
        );
        setItems((xs) => [...xs, item]);
        setQueue((q) => q.filter((u) => u.id !== id));
      } catch (e) {
        setQueue((q) =>
          q.map((u) =>
            u.id === id ? { ...u, error: (e as Error).message } : u,
          ),
        );
      }
    }
  }

  const move = (i: number, d: number) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // 영상, 3D의 미리보기는 목록에서 가장 가까운 사진으로 자동 지정
  const withPosters = items.map((m) =>
    m.kind === "image" || m.poster
      ? m
      : { ...m, poster: items.find((x) => x.kind === "image")?.src ?? null },
  );

  return (
    <fieldset className="glass flex flex-col gap-4 rounded-lg p-4 md:col-span-2">
      <legend className="px-1 text-sm font-semibold">
        {imagesOnly
          ? "작품 사진 (첫 번째 사진이 대표 이미지)"
          : "사진, 영상, 3D (첫 번째 사진이 대표 이미지)"}
      </legend>
      <input type="hidden" name="media" value={JSON.stringify(withPosters)} />

      {items.length > 0 && (
        <ol className="flex flex-wrap gap-3" aria-label="미디어 순서">
          {items.map((m, i) => (
            <li key={m.src + i} className="flex w-28 flex-col gap-1.5 text-xs">
              <div className="relative size-28 overflow-hidden rounded-[14px] bg-white">
                <WorkImage
                  src={
                    m.kind === "image"
                      ? m.src
                      : (withPosters[i].poster ?? undefined)
                  }
                  alt=""
                  className="size-full"
                />
                <span className="absolute top-1.5 left-1.5 rounded-full bg-ink/75 px-2 py-0.5 font-semibold text-white">
                  {i === 0 && m.kind === "image" ? "대표" : KIND_LABEL[m.kind]}
                </span>
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`${i + 1}번째를 앞으로`}
                  className="rounded-full px-2 py-1 hover:bg-white disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                  aria-label={`${i + 1}번째 빼기`}
                  className="rounded-full px-2 py-1 text-dot hover:bg-white"
                >
                  빼기
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`${i + 1}번째를 뒤로`}
                  className="rounded-full px-2 py-1 hover:bg-white disabled:opacity-30"
                >
                  →
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {queue.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-xs">
          {queue.map((u) => (
            <li key={u.id} className="flex items-center gap-2">
              <span className="w-40 truncate">{u.name}</span>
              {u.error ? (
                <span className="text-dot">{u.error}</span>
              ) : (
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                  <span
                    className="bg-aurora block h-full transition-[width]"
                    style={{ width: `${Math.round(u.progress * 100)}%` }}
                  />
                </span>
              )}
              {u.error && (
                <button
                  type="button"
                  onClick={() =>
                    setQueue((q) => q.filter((x) => x.id !== u.id))
                  }
                  className="underline"
                >
                  닫기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-ink/12 bg-white/80 px-4 text-sm font-semibold transition hover:bg-white">
          파일 올리기
          <input
            type="file"
            aria-label="미디어 파일"
            multiple
            accept={
              imagesOnly
                ? "image/jpeg,image/png,image/webp,image/avif"
                : "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,.glb,model/gltf-binary"
            }
            className="sr-only"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-ink-soft">
          {imagesOnly
            ? "사진 10MB까지. 실물 색에 맞춰 보정한 사진을 올려 주세요. 영상과 3D는 문의하기로 보내 주세요"
            : "사진 10MB, 영상 80MB, 3D(GLB) 30MB까지. 실물 색에 맞춰 보정한 사진을 올려 주세요"}
        </span>
      </div>
      {!imagesOnly && (
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="또는 https:// 이미지 주소"
            aria-label="이미지 주소"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (/^https:\/\/\S+$/.test(url)) {
                setItems((xs) => [...xs, { kind: "image", src: url }]);
                setUrl("");
              }
            }}
          >
            추가
          </Button>
        </div>
      )}
    </fieldset>
  );
}
