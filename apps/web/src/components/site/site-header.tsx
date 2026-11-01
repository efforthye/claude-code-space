import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { AccountLink, AccountLinkFallback } from "./account-link";
import { CartLink } from "./cart-link";
import { NavLinks, NavList } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b print:hidden border-white/60 bg-wall/70 py-1.5 backdrop-blur-xl backdrop-saturate-150">
      <Container className="flex h-14 items-center justify-between gap-3">
        <Link href="/" className="font-display text-[32px] leading-none tracking-tight transition-opacity hover:opacity-70">
          mayo
        </Link>
        <Suspense fallback={<NavList path={null} />}>
          <NavLinks />
        </Suspense>
        <div className="flex items-center gap-1.5">
          <Suspense fallback={<AccountLinkFallback />}>
            <AccountLink />
          </Suspense>
          <CartLink />
        </div>
      </Container>
    </header>
  );
}
