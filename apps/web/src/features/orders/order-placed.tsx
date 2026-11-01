"use client";

import { useEffect } from "react";
import { ConfettiBurst } from "@/components/ui/confetti";
import { rememberMine } from "@/features/my/my-store";

/** 주문 직후 한 번: 꽃가루 + 이 기기 ‘내 신청 현황’에 주문번호 저장. */
export function OrderPlaced({ code, title }: { code: string; title: string }) {
  useEffect(() => {
    rememberMine({ code, title, at: new Date().toISOString() });
  }, [code, title]);
  return <ConfettiBurst />;
}
