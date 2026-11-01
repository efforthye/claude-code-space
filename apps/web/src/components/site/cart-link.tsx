"use client";

import Link from "next/link";
import { useCart } from "@/features/cart/cart-store";

export function CartLink() {
  const lines = useCart();
  return (
    <Link
      href="/cart"
      className="glass relative inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition hover:bg-white"
    >
      장바구니
      {lines.length > 0 && (
        <span className="bg-aurora inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white">
          {lines.length}
        </span>
      )}
    </Link>
  );
}
