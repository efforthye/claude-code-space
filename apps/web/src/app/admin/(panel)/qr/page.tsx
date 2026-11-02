import Link from "next/link";
import { AdminHeading } from "@/features/admin/ui";
import { PrintButton } from "@/features/admin/print-button";
import { adminDb } from "@/features/admin/session";
import { CaptionLabel } from "@/features/labels/caption-label";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

export default async function AdminQr(props: PageProps<"/admin/qr">) {
  const sp = await props.searchParams;
  const db = await adminDb();
  const exhibitionId = typeof sp.exhibition === "string" ? sp.exhibition : db.exhibitions[0]?.id;
  const schoolById = new Map(db.schools.map((s) => [s.id, s]));
  const works = db.works.filter((w) => w.exhibitionId === exhibitionId && w.status !== "hidden");

  return (
    <>
      <div className="print:hidden">
        <AdminHeading
          title="QR 캡션 라벨"
          description={<>라벨은 실제 크기 100×70mm, A4 한 장에 6장씩 나와요. QR은 <code>{siteConfig.url}/q/작품ID</code>로 연결되니 인쇄 전에 이 주소에서 사이트가 열리는지 꼭 확인하세요. 인쇄 배율은 100%로.</>}
          action={<PrintButton />}
        />
        <div className="mb-6 flex flex-wrap gap-1.5 text-sm">
          {db.exhibitions.map((e) => (
            <Link key={e.id} href={`/admin/qr?exhibition=${e.id}`} className={cn("rounded-sm border px-3 py-1", e.id === exhibitionId ? "border-ink bg-ink text-paper" : "border-line bg-paper")}>
              {e.title}
            </Link>
          ))}
        </div>
      </div>
      <style>{`@page { size: A4; margin: 5mm; }`}</style>
      <div className="flex flex-wrap gap-4 print:gap-[2mm]">
        {works.map((w) => {
          const artist = db.artists.find((a) => a.id === w.artistId);
          return <CaptionLabel key={w.id} work={w} artist={artist} school={artist?.schoolId ? schoolById.get(artist.schoolId) : undefined} mark={db.settings.logoMark} />;
        })}
        {works.length === 0 && <p className="text-sm text-ink-soft">이 전시에 등록된 작품이 없어요.</p>}
      </div>
    </>
  );
}
