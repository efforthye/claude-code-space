"use client";

import { useEffect, useState } from "react";
import { remaining } from "./auction-panel";

/** 목록용 남은 시간 (1초마다) */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={className} suppressHydrationWarning>{remaining(Date.parse(to) - now)}</span>;
}
