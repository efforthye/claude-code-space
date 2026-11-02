import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/features/admin/print-button";
import { CaptionLabel } from "@/features/labels/caption-label";
import { getCatalog, getSiteSettings, indexById } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "캡션 라벨", robots: { index: false } };

/** 작품 한 점의 캡션 라벨을 실제 크기로 인쇄하는 페이지 (A4에 한 장, 잘라서 작품 옆에) */
export default function LabelPage(props: PageProps<"/label/[id]">) {
  return (
    <Suspense fallback={null}>
      <Label params={props.params} />
    </Suspense>
  );
}

async function Label({ params }: { params: PageProps<"/label/[id]">["params"] }) {
  const { id } = await params;
  const [{ works, artists, schools }, { logoMark }] = await Promise.all([getCatalog(), getSiteSettings()]);
  const work = works.find((w) => w.id === id);
  if (!work) notFound();
  const artist = indexById(artists).get(work.artistId);
  const school = artist?.schoolId ? indexById(schools).get(artist.schoolId) : undefined;
  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 px-5 py-10 print:block print:p-0">
      <style>{`@page { size: A4; margin: 15mm; } @media print { body { background: white !important; } }`}</style>
      <div className="flex w-full max-w-xl flex-col gap-3 print:hidden">
        <Link href={`/works/${work.id}`} className="link-sweep w-fit text-sm text-ink-soft">← 작품으로</Link>
        <h1 className="text-2xl font-bold">캡션 라벨</h1>
        <p className="text-sm text-ink-soft">실제 크기 100×70mm로 인쇄돼요. 인쇄 설정에서 배율을 100%(실제 크기)로 두고, 잘라서 작품 옆에 붙이세요. 두꺼운 종이(200g 이상)를 추천해요.</p>
        <div><PrintButton /></div>
      </div>
      <CaptionLabel work={work} artist={artist} school={school} mark={logoMark} />
    </main>
  );
}
