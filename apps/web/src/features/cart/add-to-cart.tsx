"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import type { ShippingMethod, WorkStatus } from "@/lib/domain/types";
import { cart, useCart } from "./cart-store";

export const CART_ADDED_EVENT = "mayo:cart-added";

/** 작품 사진이 장바구니 버튼으로 날아가는 모션 (움직임 줄이기 설정이면 생략). */
function flyToCart(from: DOMRect, cover: string | undefined) {
  const target = document.querySelector<HTMLElement>("[data-cart-target]");
  if (!target || !cover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const to = target.getBoundingClientRect();
  const size = 72;
  const img = document.createElement("img");
  img.src = cover;
  img.alt = "";
  Object.assign(img.style, {
    position: "fixed",
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    borderRadius: "16px",
    boxShadow: "0 18px 40px -12px rgb(60 30 120 / 0.55)",
    zIndex: "70",
    pointerEvents: "none",
  });
  document.body.appendChild(img);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  img
    .animate(
      [
        { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 120}px) scale(0.8) rotate(-8deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(0deg)`, opacity: 0.2 },
      ],
      { duration: 750, easing: "cubic-bezier(.5,0,.3,1)" },
    )
    .finished.finally(() => img.remove());
}

export function AddToCart({
  workId,
  status,
  defaultShipping,
  cover,
}: {
  workId: string;
  status: WorkStatus;
  defaultShipping: ShippingMethod;
  cover?: string;
}) {
  const lines = useCart();
  const inCart = lines.some((l) => l.workId === workId);
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (status === "sold") return <Button disabled size="lg" className="w-full">판매 완료된 작품입니다</Button>;
  if (status === "reserved") return <Button disabled size="lg" className="w-full">다른 컬렉터가 예약 중입니다</Button>;

  return (
    <>
      {inCart ? (
        <Link href="/cart" className={buttonClass("secondary", "lg", "w-full animate-[rise_350ms_ease-out]")}>
          장바구니에 담겼어요, 주문하러 가기
        </Link>
      ) : (
        <Button
          size="lg"
          className="w-full"
          onClick={(e) => {
            flyToCart(e.currentTarget.getBoundingClientRect(), cover);
            cart.add({ workId, shipping: defaultShipping });
            window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT));
            setToast(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setToast(false), 2600);
          }}
        >
          장바구니에 담기
        </Button>
      )}
      {toast && (
        <div role="status" className="glass fixed inset-x-0 bottom-24 z-[65] mx-auto flex w-fit animate-[rise_350ms_cubic-bezier(.22,1,.36,1)] items-center gap-3 rounded-full py-2 pr-2 pl-4 text-sm font-semibold sm:bottom-8">
          장바구니에 담았어요
          <Link href="/cart" className="bg-aurora rounded-full px-3 py-1.5 text-white">보러 가기</Link>
        </div>
      )}
    </>
  );
}
