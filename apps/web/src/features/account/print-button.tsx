"use client";

/** 판매 이력을 브라우저 인쇄로 PDF 저장 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="link-sweep text-sm font-semibold text-violet">
      인쇄, PDF로 저장 →
    </button>
  );
}
