import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { WorkCard } from "@/features/catalog/work-card";
import { ConsultForm } from "@/features/rental/forms";
import { rentableWorks } from "@/features/rental/picks";
import { getCatalog, indexById } from "@/lib/data/catalog";
import { categoryLabel, rentalMonthly, RENT_TO_OWN_CREDIT } from "@/lib/domain/rules";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "작품 렌탈",
  description: "학생 작가의 원작을 한 달부터 빌려 걸어 보세요. 마음에 들면 낸 렌탈료 절반을 빼고 살 수 있어요.",
};

const STEPS = [
  { t: "작품 고르기", d: "렌탈 가능 표시가 있는 작품에서 고르거나, 공간 사진과 분위기를 알려 주시면 골라 드려요." },
  { t: "기간과 설치", d: "1, 3, 6, 12개월 중에 고르고, 설치 날짜를 작가와 맞춰요. 계약 확정 전에는 돈을 받지 않아요." },
  { t: "걸어 두기", d: "렌탈료는 매달, 보증금은 반납 확인 뒤에 돌려드려요. 기간 중에 다른 작품으로 바꿀 수도 있어요." },
  { t: "사거나 돌려주기", d: `마음에 들면 낸 렌탈료의 ${Math.round(RENT_TO_OWN_CREDIT * 100)}%를 작품가에서 빼고 살 수 있어요.` },
];

export default async function RentalPage() {
  const catalog = await getCatalog();
  const works = rentableWorks(catalog);
  const artists = indexById(catalog.artists);
  const schools = indexById(catalog.schools);
  return (
    <Container className="flex flex-col gap-12 py-10">
      <PageHeading
        eyebrow="Rental"
        title="작품 렌탈"
        description="사기 전에 집에 걸어 보고 싶을 때, 매장이나 사무실 벽을 철마다 바꾸고 싶을 때. 월 렌탈료는 작품가의 3%이고, 렌탈료 일부는 작가에게 돌아가요."
      />

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="glass flex flex-col gap-2 rounded-2xl p-5">
            <span className="bg-aurora flex size-7 items-center justify-center rounded-full text-sm font-bold text-white">{i + 1}</span>
            <b>{s.t}</b>
            <p className="text-sm leading-relaxed text-ink-soft">{s.d}</p>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
          <h2 className="text-xl font-bold">렌탈할 수 있는 작품 <span className="text-ink-soft">{works.length}</span></h2>
          <Link href="/business" className="text-sm font-semibold text-violet underline underline-offset-4">매장, 사무실이라면 기업전용관</Link>
        </div>
        {works.length === 0 ? (
          <EmptyState title="지금 렌탈할 수 있는 작품이 없어요">작가가 렌탈을 허락한 작품이 올라오면 여기 모여요. 아래에서 추천을 받아 보세요.</EmptyState>
        ) : (
          <div className="columns-2 gap-6 md:columns-3 lg:columns-4">
            {works.map((w) => {
              const artist = artists.get(w.artistId);
              return (
                <div key={w.id} className="break-inside-avoid">
                  <WorkCard work={w} artist={artist} school={artist?.schoolId ? schools.get(artist.schoolId) : undefined} mediumLabel={categoryLabel(catalog.categories, w.medium)} />
                  <div className="-mt-6 mb-9 flex items-center justify-between px-1 text-sm">
                    <span>월 <b>{formatPrice(rentalMonthly(w.price))}</b></span>
                    {w.sample ? <span className="text-xs text-ink-soft">예시라 신청은 받지 않아요</span> : <ButtonLink href={`/rental/apply?work=${w.id}`} size="sm" variant="secondary">렌탈 신청</ButtonLink>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">어떤 작품이 어울릴지 모르겠다면</h2>
          <p className="leading-relaxed text-ink-soft">공간과 예산, 원하는 분위기를 알려 주세요. 학생 작가 작품 중에서 골라 사진과 함께 제안드려요. 렌탈로 걸어 보고 마음에 들면 그대로 살 수 있어요.</p>
        </div>
        <ConsultForm audience="personal" defaultKind="curation" kinds={["curation", "rental", "purchase"]} />
      </section>
    </Container>
  );
}
