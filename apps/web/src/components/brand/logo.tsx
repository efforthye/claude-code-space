import { cn } from "@/lib/cn";
import type { LogoMark } from "@/lib/domain/types";

/**
 * MAYO 로고: 작품이 된 m 마크 + DM Serif Display "ayo".
 * 마크는 public/brand/<mark>/mark.svg (원본은 apps/web/brand). 글자 크기(font-size)에 맞춰 함께 커진다.
 */
export function Logo({ mark, className, inverted = false }: { mark: LogoMark; className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-baseline leading-none", className)} data-logo-mark={mark}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${mark}/mark.svg`} alt="" aria-hidden className="h-[0.7em] w-auto" />
      <span aria-hidden className={cn("font-logo tracking-[-0.01em]", inverted ? "text-paper" : "text-ink")}>ayo</span>
      <span className="sr-only">MAYO</span>
    </span>
  );
}
