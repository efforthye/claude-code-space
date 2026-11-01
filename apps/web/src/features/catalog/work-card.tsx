import Link from "next/link";
import { RedDot } from "@/components/ui/red-dot";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import type { Artist, School, Work } from "@/lib/domain/types";
import { formatPrice } from "@/lib/format";
import { MEDIUM_LABEL } from "@/lib/domain/rules";
import { WorkImage } from "./work-image";

export function WorkCard({ work, artist, school }: { work: Work; artist?: Artist; school?: School }) {
  return (
    <Link href={`/works/${work.id}`} className="group flex flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-white/60 shadow-[0_24px_40px_-26px_rgb(60_30_120/0.55)] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_30px_50px_-24px_rgb(60_30_120/0.6)]">
        <WorkImage src={work.images[0]} alt={work.title} className="size-full transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
        {(work.status === "reserved" || work.status === "sold") && (
          <span className="glass absolute top-3 left-3 rounded-full px-2.5 py-1">
            <RedDot status={work.status} />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="link-sweep truncate text-[17px] font-semibold">{work.title}</span>
          <span className="shrink-0 text-sm font-semibold">{formatPrice(work.price)}</span>
        </div>
        <span className="text-[13px] text-ink-soft">
          {artist?.name ?? "작가 미상"} · {MEDIUM_LABEL[work.medium]}
          {work.edition && ` · ed. ${work.edition}`}
        </span>
        {artist?.verifiedBy && (
          <span className="mt-0.5">
            <VerifiedBadge method={artist.verifiedBy} schoolName={school?.shortName} />
          </span>
        )}
      </div>
    </Link>
  );
}
