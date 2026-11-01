import Link from "next/link";
import { SealIcon } from "@/components/ui/verified-badge";
import { MEDIUM_LABEL } from "@/lib/domain/rules";
import type { Artist, School, Work } from "@/lib/domain/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { WorkImage } from "./work-image";

/** 서로 다른 매체 네 점을 겹쳐 놓은 히어로 — "회화부터 가구·조각·공예까지"를 그림으로. */
const SLOTS = [
  "left-[2%] top-[8%] w-[46%] -rotate-6 z-10",
  "left-[34%] top-0 w-[40%] rotate-3 z-20",
  "right-0 top-[30%] w-[38%] -rotate-2 z-30",
  "left-[14%] bottom-0 w-[36%] rotate-2 z-20",
];

/** 등록 작품이 아직 없을 때(실서비스 오픈 전): 매체를 보여 주는 장식용 사진. 클릭되지 않는다. */
const DECOR = ["painting-red-blue", "chair-floor", "sculpture-bust", "bowl-brass"];

export function HeroCollage({ works, artists, schools }: { works: Work[]; artists: Artist[]; schools: School[] }) {
  if (works.length === 0) {
    return (
      <div aria-hidden className="relative h-[440px] sm:h-[560px]">
        {DECOR.map((name, i) => (
          <div key={name} className={cn("glass absolute rounded-[22px] p-2.5", SLOTS[i])}>
            <WorkImage src={`/samples/photos/${name}.jpg`} alt="" className="block h-auto max-h-[300px] w-full rounded-[14px]" />
          </div>
        ))}
      </div>
    );
  }
  const lead = works[0];
  const leadArtist = artists.find((a) => a.id === lead?.artistId);
  const leadSchool = schools.find((s) => s.id === leadArtist?.schoolId);
  return (
    <div className="relative h-[440px] sm:h-[560px]">
      {works.slice(0, 4).map((w, i) => (
        <Link
          key={w.id}
          href={`/works/${w.id}`}
          className={cn(
            "glass group absolute rounded-[22px] p-2.5 transition-[transform,box-shadow] duration-500 ease-out hover:z-40 hover:rotate-0 hover:scale-[1.04] hover:shadow-[0_30px_60px_-24px_rgb(60_30_120/0.6)]",
            SLOTS[i],
          )}
        >
          <WorkImage src={w.images[0]} alt={w.title} className="block h-auto max-h-[300px] w-full rounded-[14px]" />
          <span className="glass absolute right-3 bottom-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100">
            {MEDIUM_LABEL[w.medium]}
          </span>
        </Link>
      ))}
      {lead && (
        <div className="glass absolute right-[2%] bottom-[2%] z-40 hidden w-[44%] flex-col gap-1 rounded-[20px] p-4 sm:flex">
          {leadArtist?.verifiedBy && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-violet">
              <SealIcon className="size-4" />
              {leadSchool?.shortName} 학교 인증
            </span>
          )}
          <span className="font-semibold">{lead.title}</span>
          <span className="text-[13px] text-ink-soft">{leadArtist?.name} · {formatPrice(lead.price)}</span>
        </div>
      )}
    </div>
  );
}
