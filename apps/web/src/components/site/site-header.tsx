import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { CartLink } from "./cart-link";
import { NavLinks, NavList } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-wall/70 py-1.5 backdrop-blur-xl backdrop-saturate-150">
      <Container className="flex h-14 items-center justify-between gap-3">
        <Link href="/" className="font-display text-[32px] leading-none tracking-tight transition-opacity hover:opacity-70">
          mayo
        </Link>
        <Suspense fallback={<NavList path={null} />}>
          <NavLinks />
        </Suspense>
        <div className="flex items-center gap-1.5">
          <Link href="/my" className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-white/70 hover:text-ink sm:inline">
            내 신청
          </Link>
          <CartLink />
        </div>
      </Container>
    </header>
  );
}
