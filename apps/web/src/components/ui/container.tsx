import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 border-b border-ink pb-5">
      {eyebrow && <p className="text-xs font-semibold tracking-widest text-ink-soft uppercase">{eyebrow}</p>}
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {description && <div className="text-sm text-ink-soft">{description}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line bg-paper px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-ink-soft">{children}</div>}
    </div>
  );
}
