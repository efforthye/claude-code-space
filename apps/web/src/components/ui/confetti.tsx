"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#1b2a55", "#c47a4e", "#d0312d", "#8aa0c8", "#e8e3d9", "#2f7d5b", "#f3c969"];

/** 한 번 터지는 축하 꽃가루. 움직임 줄이기 설정이면 그리지 않는다. */
export function ConfettiBurst() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; round: boolean };
    const parts: P[] = [];
    const burst = (x: number, y: number, n: number, spread: number, dir: number) => {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread;
        const sp = 7 + Math.random() * 10;
        parts.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 10,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          round: Math.random() < 0.3,
        });
      }
    };
    // 양쪽 아래에서 위로, 가운데에서 한 번 더
    burst(innerWidth * 0.1, innerHeight * 0.85, 90, 0.9, -Math.PI / 2 + 0.45);
    burst(innerWidth * 0.9, innerHeight * 0.85, 90, 0.9, -Math.PI / 2 - 0.45);
    const t2 = setTimeout(() => burst(innerWidth / 2, innerHeight * 0.35, 70, Math.PI * 2, 0), 250);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const fade = Math.max(0, 1 - (now - start - 2200) / 1200);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
        ctx.restore();
      }
      if (fade > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t2);
      removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
