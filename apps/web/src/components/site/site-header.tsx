import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/lib/data/catalog";
import { AccountLink, AccountLinkFallback } from "./account-link";
import { CartLink } from "./cart-link";
import { NavLinks, NavList } from "./nav-links";

export async function SiteHeader() {
  const { logoMark } = await getSiteSettings();
  return (
    <header className="sticky top-0 z-30 border-b print:hidden border-white/60 bg-wall/70 py-1.5 backdrop-blur-xl backdrop-saturate-150">
      <Container className="flex h-14 items-center justify-between gap-3">
        <Link href="/" aria-label="MAYO 홈" className="text-[27px]">
          <Logo mark={logoMark} />
        </Link>
        <Suspense fallback={<NavList path={null} />}>
          <NavLinks />
        </Suspense>
        <div className="flex items-center gap-1.5">
          <Link href="/business" className="hidden rounded-full border border-ink/15 px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-white/70 lg:inline">
            기업전용관
          </Link>
          <Suspense fallback={<AccountLinkFallback />}>
            <AccountLink />
          </Suspense>
          <CartLink />
        </div>
      </Container>
    </header>
  );
}
