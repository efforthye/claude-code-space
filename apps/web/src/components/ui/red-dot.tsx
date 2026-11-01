import type { WorkStatus } from "@/lib/domain/types";

/** 갤러리 관례: 예약, 판매된 작품 캡션 옆의 빨간 점. */
export function RedDot({ status }: { status: WorkStatus }) {
  if (status !== "reserved" && status !== "sold") return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-dot">
      <span aria-hidden className="size-2.5 rounded-full bg-dot" />
      {status === "sold" ? "판매 완료" : "예약 중"}
    </span>
  );
}
