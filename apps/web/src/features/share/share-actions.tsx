"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const pill = "glass inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors duration-200 hover:bg-white";

/**
 * 공유와 내보내기: 공유하기(휴대폰은 공유 시트, 아니면 링크 복사), QR 보기와 저장(PNG, SVG),
 * 캡션 라벨 인쇄, 이 페이지 인쇄(PDF 저장).
 */
export function ShareActions({
  url,
  title,
  qrSrc,
  qrName,
  labelHref,
  printable = false,
  className,
}: {
  url: string;
  title: string;
  qrSrc: string;
  qrName: string;
  labelHref?: string;
  printable?: boolean;
  className?: string;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 사용자가 공유 시트를 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("링크를 복사해 주세요", url);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2 print:hidden", className)}>
      <button type="button" onClick={share} className={pill}>
        <ShareIcon /> {copied ? "링크를 복사했어요" : "공유하기"}
      </button>
      <button type="button" onClick={() => setQrOpen(true)} className={pill}>
        <QrIcon /> QR 보기
      </button>
      {labelHref && (
        <Link href={labelHref} className={pill}>
          <PrintIcon /> 캡션 라벨 인쇄
        </Link>
      )}
      {printable && (
        <button type="button" onClick={() => window.print()} className={pill}>
          <PrintIcon /> 인쇄, PDF 저장
        </button>
      )}
      {qrOpen && <QrDialog src={qrSrc} name={qrName} url={url} onClose={() => setQrOpen(false)} />}
    </div>
  );
}

function QrDialog({ src, name, url, onClose }: { src: string; name: string; url: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} QR`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-xs animate-[rise_200ms_ease-out] flex-col items-center gap-4 rounded-xl bg-white p-6 shadow-2xl">
        <p className="text-center font-bold">{name}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${name} QR 코드`} className="size-56" />
        <p className="max-w-full truncate text-xs text-ink-soft">{url.replace(/^https?:\/\//, "")}</p>
        <div className="flex w-full gap-2">
          <a href={`${src}?format=png&download=1`} className="flex h-10 flex-1 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">PNG 저장</a>
          <a href={`${src}?download=1`} className="flex h-10 flex-1 items-center justify-center rounded-full border border-ink/15 text-sm font-semibold">SVG 저장</a>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className="text-sm text-ink-soft underline-offset-2 hover:underline">닫기</button>
      </div>
    </div>,
    document.body,
  );
}

const icon = "size-4";
function ShareIcon() {
  return <svg viewBox="0 0 20 20" className={icon} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13V3M6 7l4-4 4 4M4 11v5h12v-5" /></svg>;
}
function QrIcon() {
  return <svg viewBox="0 0 20 20" className={icon} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><path d="M12 12h2v2M17 12v5h-5" /></svg>;
}
function PrintIcon() {
  return <svg viewBox="0 0 20 20" className={icon} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 8V3h8v5M6 14H4V8h12v6h-2M6 12h8v5H6z" /></svg>;
}
