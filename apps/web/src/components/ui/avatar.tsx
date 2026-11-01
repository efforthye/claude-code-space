import { cn } from "@/lib/cn";

/** 작가 프로필 사진. 없으면 이름 첫 글자를 오로라 원 위에. */
export function Avatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", !src && "bg-aurora", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} 프로필 사진`} className="size-full object-cover" />
      ) : (
        <span aria-hidden className="text-[0.42em] font-bold text-white">{[...name.trim()][0] ?? "?"}</span>
      )}
    </span>
  );
}
