import Link from "next/link";
import QRCode from "qrcode";
import { AdminHeading } from "@/features/admin/ui";
import { PrintButton } from "@/features/admin/print-button";
import { adminDb } from "@/features/admin/session";
import { formatPrice, formatSize } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

export default async function AdminQr(props: PageProps<"/admin/qr">) {
  const sp = await props.searchParams;
  const db = await adminDb();
  const exhibitionId = typeof sp.exhibition === "string" ? sp.exhibition : db.exhibitions[0]?.id;
  const artistName = new Map(db.artists.map((a) => [a.id, a.name]));
  const works = db.works.filter((w) => w.exhibitionId === exhibitionId && w.status !== "hidden");
  const labels = await Promise.all(
    works.map(async (w) => ({
      w,
      svg: await QRCode.toString(`${siteConfig.url}/q/${w.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1b2a55", light: "#ffffff" } }),
    })),
  );

  return (
    <>
      <div className="print:hidden">
        <AdminHeading
          title="QR 캡션 라벨"
          description={<>QR은 <code>{siteConfig.url}/q/작품ID</code>로 연결돼요. 인쇄 전에 이 주소에서 사이트가 실제로 열리는지 꼭 확인하세요.</>}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
        {labels.map(({ w, svg }) => (
          <div key={w.id} className="flex break-inside-avoid gap-4 border border-ink bg-paper p-4">
            <div className="flex flex-1 flex-col gap-0.5 text-sm">
              <p className="font-bold">{artistName.get(w.artistId)}</p>
              <p className="italic">「{w.title}」, {w.year}</p>
              <p>{w.materials}</p>
              <p>{formatSize(w.widthCm, w.heightCm, w.depthCm)}{w.edition && ` · ed. ${w.edition}`}</p>
              <p className="mt-2 font-bold">{formatPrice(w.price)}</p>
              <p className="mt-auto pt-2 text-[10px] text-ink-soft">QR로 작품 보기 · 소장 신청 — MAYO</p>
            </div>
            <div className="size-24 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        ))}
        {labels.length === 0 && <p className="text-sm text-ink-soft">이 전시에 등록된 작품이 없어요.</p>}
      </div>
    </>
  );
}
