import { Children, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** 쉼표 대신 얇은 세로선으로 나눈 정보 한 줄. 빈 항목(false, null, "")은 건너뛴다. */
export function MetaLine({ children, className }: { children: ReactNode; className?: string }) {
  // toArray가 null, false, undefined는 이미 뺀다
  const items = Children.toArray(children).filter((c) => c !== "");
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-y-0.5", className)}>
      {items.map((c, i) => (
        <span key={i} className={cn(i > 0 && "ml-2 border-l border-current/25 pl-2")}>
          {c}
        </span>
      ))}
    </span>
  );
}

/** 라벨과 값 한 쌍 (푸터 사업자 정보 같은 곳). */
export function LabeledValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex gap-1.5">
      <span className="text-ink-soft/80">{label}</span>
      <span className="text-ink">{children}</span>
    </span>
  );
}
