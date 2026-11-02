import { Logo } from "@/components/brand/logo";
import { MetaLine } from "@/components/ui/meta-line";
import { SealIcon } from "@/components/ui/verified-badge";
import type { Artist, LogoMark, School, Work } from "@/lib/domain/types";
import { formatPrice, formatSize } from "@/lib/format";

/**
 * 전시장 캡션 라벨, 실제 크기 100×70mm. 화면에서도 같은 비율로 보이고 인쇄하면 그 크기로 나온다.
 * 작가, 작품명과 연도, 재료, 크기와 에디션, 가격(또는 판매 상태), 학교 인증, 작품으로 가는 QR.
 */
export function CaptionLabel({ work, artist, school, mark }: { work: Work; artist?: Artist; school?: School; mark: LogoMark }) {
  const sold = work.status === "sold";
  const reserved = work.status === "reserved";
  return (
    <article
      className="relative flex h-[70mm] w-[100mm] shrink-0 flex-col justify-between overflow-hidden bg-white p-[6mm] text-ink shadow-[0_1px_0_rgba(29,21,48,0.08),0_12px_30px_-18px_rgba(29,21,48,0.35)] print:shadow-none print:outline print:outline-[0.2mm] print:outline-ink/20 break-inside-avoid"
      aria-label={`${work.title} 캡션 라벨`}
    >
      <div className="flex gap-[5mm]">
        <div className="flex min-w-0 flex-1 flex-col gap-[1.2mm]">
          <p className="text-[13pt] leading-tight font-bold">{artist?.name ?? "작가 미상"}</p>
          {(school || artist?.department) && (
            <p className="text-[7.5pt] text-ink-soft">
              <MetaLine>{school?.name}{artist?.department}</MetaLine>
            </p>
          )}
          <p className="mt-[1.5mm] font-display text-[14pt] leading-tight italic">{work.title}<span className="not-italic text-[10pt] text-ink-soft">, {work.year}</span></p>
          <p className="text-[8pt] leading-snug">{work.materials}</p>
          <p className="text-[8pt] leading-snug text-ink-soft">
            {formatSize(work.widthCm, work.heightCm, work.depthCm)}
            {work.edition && <>, ed. {work.edition}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-[1mm]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/qr/work/${work.id}`} alt={`「${work.title}」 작품 페이지 QR`} className="size-[24mm]" />
          <span className="text-[6pt] text-ink-soft">작품 보기, 소장 신청</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-[3mm] border-t border-ink/15 pt-[2.5mm]">
        <div className="flex items-center gap-[2mm]">
          {sold || reserved ? (
            <span className="flex items-center gap-[1.5mm] text-[9pt] font-bold">
              <span className="size-[3.2mm] rounded-full bg-[#e5484d]" aria-hidden />
              {sold ? "판매 완료" : "예약 중"}
            </span>
          ) : (
            <span className="text-[11pt] font-bold">{formatPrice(work.price)}</span>
          )}
          {artist?.verifiedBy && school && (
            <span className="flex items-center gap-[1mm] text-[6.5pt] font-semibold">
              <SealIcon className="size-[3.5mm]" />
              {school.shortName} 인증
            </span>
          )}
        </div>
        <Logo mark={mark} className="text-[12pt]" />
      </div>
    </article>
  );
}
