import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** 섹션 머리말: 작은 유리 알약 + 그라데이션 점. 자간을 벌리지 않는다. */
export function Eyebrow({ children, tone = "light", className }: { children: ReactNode; tone?: "light" | "dark"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold",
        tone === "light" ? "bg-white/70 text-ink backdrop-blur" : "bg-white/15 text-white",
        className,
      )}
    >
      <span aria-hidden className="bg-aurora size-1.5 rounded-full" />
      {children}
    </span>
  );
}
