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
  // backdrop-filter는 fixed 자식의 기준을 헤더로 바꾼다. 휴대폰에선 아래 고정 내비가 헤더 안에 갇히지 않도록 흐림 없이
  return (
    <header className="sticky top-0 z-30 border-b print:hidden border-white/60 bg-wall/92 py-1.5 sm:bg-wall/70 sm:backdrop-blur-xl sm:backdrop-saturate-150">
      <Container className="flex h-14 items-center justify-between gap-3">
        <Link href="/" aria-label="MAYO 홈" className="text-[34px] transition-opacity hover:opacity-75">
          <Logo mark={logoMark} />
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
