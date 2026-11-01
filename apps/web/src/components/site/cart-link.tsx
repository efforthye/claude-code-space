"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_ADDED_EVENT } from "@/features/cart/add-to-cart";
import { useCart } from "@/features/cart/cart-store";
import { cn } from "@/lib/cn";

export function CartLink() {
  const lines = useCart();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    // 날아온 사진이 도착할 즈음 배지가 튄다
    const onAdded = () => setTimeout(() => setBump((n) => n + 1), 650);
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CART_ADDED_EVENT, onAdded);
  }, []);
  return (
    <Link
      href="/cart"
      data-cart-target
      key={bump}
      className={cn(
        "glass relative inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition hover:bg-white",
        bump > 0 && "animate-[bump_500ms_cubic-bezier(.3,1.6,.5,1)]",
      )}
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
