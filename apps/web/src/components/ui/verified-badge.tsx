import { VERIFY_LABEL } from "@/lib/domain/rules";
import type { VerifyMethod } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** 톱니 인장 + 체크: 공식 인증에서 쓰는 형태. 디자인 토큰의 ink를 쓴다. */
export function SealIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("shrink-0", className)}>
      <path
        className="fill-ink"
        d="M12 1.5l2.1 1.6 2.6-.4 1 2.4 2.4 1-.4 2.6L21.3 12l-1.6 2.1.4 2.6-2.4 1-1 2.4-2.6-.4L12 22.5l-2.1-1.6-2.6.4-1-2.4-2.4-1 .4-2.6L2.7 12l1.6-2.1-.4-2.6 2.4-1 1-2.4 2.6.4z"
      />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 목록, 캡션용 작은 인증 배지. */
export function VerifiedBadge({
  method,
  schoolName,
  showMethod = false,
}: {
  method: VerifyMethod | null;
  schoolName?: string | null;
  showMethod?: boolean;
}) {
  if (!method) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-ink/25 bg-mist py-0.5 pr-2 pl-0.5 text-[11px] font-bold text-ink"
      title={`MAYO가 ${VERIFY_LABEL[method]}로 소속을 확인했어요`}
    >
      <SealIcon className="size-4" />
      {schoolName ? `${schoolName} 인증` : "학교 인증"}
      {showMethod && <span className="font-medium text-ink-soft">{VERIFY_LABEL[method]}</span>}
    </span>
  );
}

/** 작품, 작가 상세의 인증 카드: 무엇으로, 언제 확인했는지까지 보여 준다. */
export function VerificationCard({
  method,
  verifiedAt,
  schoolName,
  department,
  statusLabel,
}: {
  method: VerifyMethod | null;
  verifiedAt: string | null;
  schoolName?: string | null;
  department?: string | null;
  statusLabel: string;
}) {
  if (!method) {
    return (
      <div className="rounded-md border border-dashed border-line bg-paper p-3 text-xs text-ink-soft">
        아직 학교 인증을 받지 않은 작가예요. 소속은 작가가 직접 입력한 정보입니다.
      </div>
    );
  }
  return (
    <div className="glass flex items-center gap-4 rounded-lg p-4">
      <SealIcon className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-violet">MAYO 학교 인증</span>
          <p className="font-bold">{[schoolName, department, statusLabel].filter(Boolean).join(" ")}</p>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <div className="flex gap-1.5"><dt className="text-ink-soft">확인 방법</dt><dd className="font-medium">{VERIFY_LABEL[method]}</dd></div>
          {verifiedAt && <div className="flex gap-1.5"><dt className="text-ink-soft">확인일</dt><dd className="font-medium tabular-nums">{formatDate(verifiedAt)}</dd></div>}
        </dl>
      </div>
    </div>
  );
}
