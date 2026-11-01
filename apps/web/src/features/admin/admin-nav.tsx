"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/orders", label: "주문과 입금" },
  { href: "/admin/works", label: "작품" },
  { href: "/admin/categories", label: "매체 분류" },
  { href: "/admin/artist-groups", label: "작가 구분" },
  { href: "/admin/compliance", label: "신고, 법무" },
  { href: "/admin/settings", label: "사이트 설정" },
  { href: "/admin/artists", label: "작가" },
  { href: "/admin/applications", label: "입점 신청" },
  { href: "/admin/exhibitions", label: "전시" },
  { href: "/admin/exhibition-requests", label: "전시 등록 신청" },
  { href: "/admin/schools", label: "학교" },
  { href: "/admin/inquiries", label: "문의" },
  { href: "/admin/qr", label: "QR 라벨" },
  { href: "/admin/ledger", label: "유통 내역" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn("shrink-0 rounded-sm px-3 py-2 text-sm font-medium", active ? "bg-ink text-paper" : "text-ink-soft hover:bg-mist hover:text-ink")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
