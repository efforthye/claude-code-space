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
        <Link href="/" className="text-xl font-black tracking-tight">
          MAYO
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-sm px-3 py-2 text-sm font-medium text-ink-soft hover:bg-mist hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/join" className="hidden rounded-sm px-2 py-2 text-sm font-medium text-ink-soft hover:text-ink sm:inline">
            작가 입점
          </Link>
          <CartLink />
        </div>
      </Container>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 sm:hidden">
        {[...NAV, { href: "/join", label: "작가 입점" }].map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 px-3 py-2 text-sm font-medium text-ink-soft">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
