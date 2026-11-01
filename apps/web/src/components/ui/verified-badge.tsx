import { VERIFY_LABEL } from "@/lib/domain/rules";
import type { VerifyMethod } from "@/lib/domain/types";

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
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink" title={`${VERIFY_LABEL[method]}로 확인`}>
      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-ink">
        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.6 6.1-4.2 4.6a.8.8 0 0 1-1.2 0L4.4 8.8a.8.8 0 1 1 1.2-1.1l1.2 1.3 3.6-4a.8.8 0 1 1 1.2 1.1Z" />
      </svg>
      {schoolName ? `${schoolName} 인증` : "학교 인증"}
      {showMethod && <span className="font-normal text-ink-soft">· {VERIFY_LABEL[method]}</span>}
    </span>
  );
}
