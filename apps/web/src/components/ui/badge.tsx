import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "violet" | "ink" | "clay" | "ok" | "warn" | "dot";

const tones: Record<Tone, string> = {
  neutral: "bg-mist text-ink-soft",
  violet: "bg-violet text-white",
  ink: "bg-violet text-white",
  clay: "bg-clay-soft text-clay",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  dot: "bg-pink text-white",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
