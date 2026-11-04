"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; badge?: number };

/** 마이페이지 왼쪽 메뉴 (휴대폰에선 가로로 넘기는 칩) */
export function AccountNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // 가장 길게 맞는 주소 하나만 활성 (/account/sell 과 /account/sell/works 구분)
  const active = items.filter((i) => path === i.href || path.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="마이페이지 메뉴" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active === i.href ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 md:rounded-xl",
            active === i.href ? "bg-ink text-white" : "text-ink-soft hover:bg-white/80 hover:text-ink",
          )}
        >
          {i.label}
          {i.badge ? <span className="bg-aurora rounded-full px-2 py-0.5 text-[11px] text-white">{i.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
