"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { NAV } from "./nav-links";

/**
 * 휴대폰 메뉴: 헤더의 햄버거 버튼으로 연다. 헤더 아래를 덮는 시트는 body에 붙여서
 * 헤더의 backdrop-filter에 갇히지 않게 한다. 페이지를 옮기거나 Esc를 누르면 닫힌다.
 */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    // 링크로 이동하면 닫는다 (렌더 중 상태 조정, effect 없이)
    setLastPath(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const secondary = [
    signedIn ? { href: "/account", label: "마이페이지" } : { href: "/login", label: "로그인" },
    ...(signedIn ? [] : [{ href: "/signup", label: "회원가입" }]),
    { href: "/my", label: "비회원 주문 조회" },
    { href: "/contact", label: "문의하기" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        className="glass order-last flex size-10 items-center justify-center rounded-full md:hidden"
      >
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d={open ? "M5 5l10 10M15 5 5 15" : "M3.5 6h13M3.5 10h13M3.5 14h13"} className="transition-[d] duration-200" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="메뉴" className="fixed inset-x-0 top-[69px] bottom-0 z-[60] flex flex-col overflow-y-auto bg-wall/96 px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
            <nav className="flex flex-col">
              {NAV.map((n, i) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  style={{ animationDelay: `${i * 35}ms` }}
                  className={cn(
                    "flex animate-[rise_300ms_ease-out_both] items-center justify-between border-b border-ink/8 py-4 text-2xl font-bold",
                    n.match(path) ? "text-violet" : "text-ink",
                  )}
                >
                  {n.label}
                  <span aria-hidden className="text-base text-ink-soft">→</span>
                </Link>
              ))}
            </nav>
            <div className="mt-6 flex flex-wrap gap-2">
              {secondary.map((s) => (
                <Link key={s.href} href={s.href} onClick={() => setOpen(false)} className="glass rounded-full px-4 py-2.5 text-sm font-semibold">
                  {s.label}
                </Link>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
