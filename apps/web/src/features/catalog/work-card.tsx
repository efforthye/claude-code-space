import Link from "next/link";
import { RedDot } from "@/components/ui/red-dot";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import type { Artist, School, Work } from "@/lib/domain/types";
import { formatPrice } from "@/lib/format";
import { coverImage } from "@/lib/domain/rules";
import { WorkImage } from "./work-image";

export function WorkCard({ work, artist, school, mediumLabel }: { work: Work; artist?: Artist; school?: School; mediumLabel: string }) {
  return (
    <Link href={`/works/${work.id}`} className="group mb-9 flex break-inside-avoid flex-col gap-3">
      <div className="relative overflow-hidden rounded-[22px] bg-white/60 shadow-[0_24px_40px_-26px_rgb(60_30_120/0.55)] transition-[translate,rotate,scale,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_30px_50px_-24px_rgb(60_30_120/0.6)]">
        {/* 작품 비율 그대로, 가로 가구는 가로로, 세로 회화는 세로로 */}
        <WorkImage src={coverImage(work)} alt={work.title} className="block h-auto w-full transition-[translate,rotate,scale,transform] duration-500 ease-out group-hover:scale-[1.04]" />
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
          {artist?.name ?? "작가 미상"}, {mediumLabel}
          {work.edition && `, ed. ${work.edition}`}
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

/** 한 줄 진열용: 같은 비율(4:5)로 잘라 줄을 맞춘다. */
export function WorkTile(props: { work: Work; artist?: Artist; school?: School; mediumLabel: string }) {
  return (
    <div className="[&_img]:aspect-[4/5] [&_img]:object-cover [&>a]:mb-0">
      <WorkCard {...props} />
    </div>
  );
}
