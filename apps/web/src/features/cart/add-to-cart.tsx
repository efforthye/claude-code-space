"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import type { ShippingMethod, WorkStatus } from "@/lib/domain/types";
import { cart, useCart } from "./cart-store";

export function AddToCart({ workId, status, defaultShipping }: { workId: string; status: WorkStatus; defaultShipping: ShippingMethod }) {
  const lines = useCart();
  const inCart = lines.some((l) => l.workId === workId);

  if (status === "sold") return <Button disabled size="lg" className="w-full">판매 완료된 작품입니다</Button>;
  if (status === "reserved")
    return <Button disabled size="lg" className="w-full">다른 컬렉터가 예약 중입니다</Button>;
  if (inCart)
    return (
      <Link href="/cart" className={buttonClass("secondary", "lg", "w-full")}>
        장바구니에 담겼어요 · 주문하러 가기
      </Link>
    );
  return (
    <Button size="lg" className="w-full" onClick={() => cart.add({ workId, shipping: defaultShipping })}>
      장바구니에 담기
    </Button>
  );
}
