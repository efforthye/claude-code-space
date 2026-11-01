"use client";

import Link from "next/link";
import { useCart } from "@/features/cart/cart-store";

export function CartLink() {
  const lines = useCart();
  return (
    <Link href="/cart" className="relative inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold transition-colors hover:bg-mist">
      장바구니
      {lines.length > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-dot px-1 text-xs text-paper">
          {lines.length}
        </span>
      )}
    </Link>
  );
}
