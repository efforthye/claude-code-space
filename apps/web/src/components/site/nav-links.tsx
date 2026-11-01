"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/works", label: "작품", match: (p: string) => p.startsWith("/works") },
  { href: "/exhibitions", label: "전시", match: (p: string) => p.startsWith("/exhibitions") },
  { href: "/artists", label: "작가", match: (p: string) => p.startsWith("/artists") },
  { href: "/schools", label: "학교", match: (p: string) => p.startsWith("/schools") },
  { href: "/join", label: "입점", match: (p: string) => p.startsWith("/join") },
];

/** 유리 알약 내비게이션, 지금 있는 곳이 채워진다. */
export function NavLinks() {
  return <NavList path={usePathname()} />;
}

/** 경로를 모를 때(정적 셸) 쓰는 같은 모양의 메뉴. NavLinks를 Suspense로 감쌀 때 fallback. */
export function NavList({ path }: { path: string | null }) {
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 flex justify-between gap-1 rounded-full p-1.5 text-sm font-medium sm:static sm:inset-auto sm:justify-start">
      {NAV.map((n) => {
        const active = path !== null && n.match(path);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-center transition-colors sm:flex-none",
              active ? "bg-ink text-white" : "text-ink-soft hover:bg-white/80 hover:text-ink",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
