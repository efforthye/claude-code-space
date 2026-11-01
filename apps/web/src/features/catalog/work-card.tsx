import Link from "next/link";
import { RedDot } from "@/components/ui/red-dot";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { KIND_LABEL } from "@/lib/domain/rules";
import type { Artist, School, Work } from "@/lib/domain/types";
import { formatPrice, formatSize } from "@/lib/format";
import { WorkImage } from "./work-image";

/** 미술관 벽 캡션 형식의 작품 카드 (가이드 11장 ①). */
export function WorkCard({ work, artist, school }: { work: Work; artist?: Artist; school?: School }) {
  return (
    <Link href={`/works/${work.id}`} className="group flex flex-col gap-3">
      <div className="aspect-[4/5] overflow-hidden bg-paper p-3 shadow-[0_1px_0_var(--color-line)] transition group-hover:shadow-md">
        <WorkImage src={work.images[0]} alt={work.title} className="size-full" />
      </div>
      <div className="flex flex-col gap-0.5 border-l-2 border-ink pl-3 text-sm">
        <p className="font-semibold">{artist?.name ?? "작가 미상"}</p>
        <p className="italic">
          「{work.title}」, {work.year}
        </p>
        <p className="text-ink-soft">{work.materials}</p>
        <p className="text-ink-soft">
          {formatSize(work.widthCm, work.heightCm, work.depthCm)}
          {work.edition && ` · ed. ${work.edition}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">{formatPrice(work.price)}</span>
          <RedDot status={work.status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          {artist && <VerifiedBadge method={artist.verifiedBy} schoolName={school?.shortName} />}
          <span>{KIND_LABEL[work.kind]}</span>
        </div>
      </div>
    </Link>
  );
}
