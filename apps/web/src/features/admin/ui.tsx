import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function AdminHeading({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-4">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: ReactNode; href?: string; tone?: "warn" | "dot" }) {
  const body = (
    <div className={cn("flex flex-col gap-1 rounded-md border bg-paper p-4", tone === "warn" ? "border-warn" : tone === "dot" ? "border-dot" : "border-line")}>
      <span className="text-xs text-ink-soft">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
  return href ? <Link href={href} className="block transition-transform duration-150 hover:-translate-y-0.5 [&>div]:transition-shadow hover:[&>div]:shadow-md">{body}</Link> : body;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-paper">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-mist text-xs text-ink-soft">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-top", className)}>{children}</td>;
}

export function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="mb-4 rounded-sm bg-ok-soft p-3 text-sm font-medium text-ok">저장했어요.</p>;
}
