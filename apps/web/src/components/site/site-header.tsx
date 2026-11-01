import Link from "next/link";
import { Container } from "@/components/ui/container";
import { CartLink } from "./cart-link";

const NAV = [
  { href: "/#collection", label: "작품" },
  { href: "/exhibitions", label: "전시" },
  { href: "/artists", label: "작가" },
  { href: "/schools", label: "학교" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-wall/95 backdrop-blur">
      <Container className="flex h-14 items-center justify-between gap-4">
        <Link href="/" className="text-xl font-black tracking-tight transition-opacity hover:opacity-70">
          MAYO
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink">
              <span className="link-sweep pb-0.5">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/my" className="link-sweep hidden px-2 py-0.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline">
            내 신청
          </Link>
          <Link href="/join" className="link-sweep hidden px-2 py-0.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline">
            작가 입점
          </Link>
          <CartLink />
        </div>
      </Container>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 sm:hidden">
        {[...NAV, { href: "/join", label: "작가 입점" }, { href: "/my", label: "내 신청" }].map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 px-3 py-2 text-sm font-medium text-ink-soft">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
