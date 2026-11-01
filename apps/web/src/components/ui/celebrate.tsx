"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { rememberMine } from "@/features/my/my-store";
import { ConfettiBurst } from "./confetti";
import { SealIcon } from "./verified-badge";

/**
 * 제출 완료 화면: 꽃가루 + 인장 + 조회 번호. 번호는 이 기기의 ‘내 신청 현황’에 저장한다.
 */
export function Celebrate({
  eyebrow,
  title,
  children,
  code,
  codeTitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  code: string;
  codeTitle: string;
  actions?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    rememberMine({ code, title: codeTitle, at: new Date().toISOString() });
  }, [code, codeTitle]);

  return (
    <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-md border-2 border-ink bg-paper px-6 py-10 text-center">
      <ConfettiBurst />
      <div className="animate-[seal-pop_700ms_cubic-bezier(.2,1.6,.4,1)_both]">
        <SealIcon className="size-20 drop-shadow-[0_8px_16px_rgb(27_42_85/0.3)]" />
      </div>
      <p className="animate-[rise_500ms_200ms_ease-out_both] text-xs font-bold tracking-widest text-clay">{eyebrow}</p>
      <h2 className="animate-[rise_500ms_300ms_ease-out_both] text-2xl font-black sm:text-3xl">{title}</h2>
      {children && <div className="max-w-md animate-[rise_500ms_400ms_ease-out_both] text-sm leading-relaxed text-ink-soft">{children}</div>}
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}
        className="animate-[rise_500ms_500ms_ease-out_both] rounded-sm border border-dashed border-ink px-4 py-2 font-mono text-lg font-bold tracking-wider transition-colors hover:bg-mist"
        title="눌러서 복사"
      >
        {code}
        <span className="ml-2 font-sans text-xs font-medium text-ink-soft">{copied ? "복사했어요" : "복사"}</span>
      </button>
      <p className="-mt-2 text-xs text-ink-soft">이 번호로 진행 상황을 볼 수 있어요. 이 기기에도 저장해 두었어요.</p>
      <div className="flex animate-[rise_500ms_600ms_ease-out_both] flex-wrap justify-center gap-2">
        <Link href="/my" className="inline-flex h-10 items-center rounded-sm bg-ink px-4 text-sm font-semibold text-paper shadow-sm transition hover:bg-ink/88 hover:shadow-md active:scale-[0.98]">
          내 신청 현황 보기
        </Link>
        {actions}
      </div>
    </div>
  );
}
