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

/** 목록·캡션용 작은 인증 배지. */
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
      {showMethod && <span className="font-medium text-ink-soft">· {VERIFY_LABEL[method]}</span>}
    </span>
  );
}

/** 작품·작가 상세의 인증 카드: 무엇으로, 언제 확인했는지까지 보여 준다. */
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
    <div className="flex items-start gap-3 rounded-md border border-ink/20 bg-mist p-3">
      <SealIcon className="size-9" />
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-bold">
          {[schoolName, department].filter(Boolean).join(" ")} {statusLabel} · MAYO 인증
        </p>
        <p className="text-xs text-ink-soft">
          {VERIFY_LABEL[method]}로 확인{verifiedAt && ` · ${formatDate(verifiedAt)}`} · 확인에 쓴 서류는 보관하지 않고 바로 파기했어요
        </p>
      </div>
    </div>
  );
}
