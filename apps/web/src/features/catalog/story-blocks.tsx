import type { StoryBlock } from "@/lib/domain/types";

/** 글과 사진을 번갈아 보여 주는 읽을거리 (작품 이야기, 작업실 소개). */
export function StoryBlocks({ blocks, eyebrow, title, alt }: { blocks: StoryBlock[]; eyebrow: string; title: string; alt: string }) {
  if (blocks.length === 0) return null;
  const id = `${eyebrow.replace(/\W+/g, "-").toLowerCase()}-heading`;
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8" aria-labelledby={id}>
      <div className="flex flex-col gap-1">
        <span className="font-display text-sm text-violet italic">{eyebrow}</span>
        <h2 id={id} className="text-2xl font-bold">{title}</h2>
      </div>
      {blocks.map((b, i) =>
        b.kind === "text" ? (
          <p key={i} className="text-[17px] leading-[1.85] whitespace-pre-line">{b.text}</p>
        ) : (
          <figure key={i} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={b.caption ?? `${alt} 사진 ${i + 1}`} loading="lazy" className="w-full" />
            {b.caption && <figcaption className="text-sm text-ink-soft">{b.caption}</figcaption>}
          </figure>
        ),
      )}
    </section>
  );
}
