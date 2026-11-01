import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/container";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { CollectionBrowser } from "@/features/catalog/collection-browser";
import { WorkImage } from "@/features/catalog/work-image";
import { exhibitionPhase, getCatalog, indexById, PHASE_LABEL } from "@/lib/data/catalog";
import { formatPeriod, formatPrice } from "@/lib/format";

export default async function HomePage() {
  const { works, artists, schools, exhibitions, today } = await getCatalog();
  const artistById = indexById(artists);
  const schoolById = indexById(schools);
  const hero = works.find((w) => w.featured && w.status === "available") ?? works.find((w) => w.status === "available");
  const heroArtist = hero ? artistById.get(hero.artistId) : undefined;
  const stories = exhibitions
    .map((e) => ({ e, phase: exhibitionPhase(e, today) }))
    .filter((x) => x.phase !== "ended")
    .sort((a, b) => a.e.startDate.localeCompare(b.e.startDate))
    .slice(0, 12);

  return (
    <>
      <section className="border-b border-line bg-paper">
        <Container className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div className="flex flex-col gap-5">
            <p className="text-sm font-semibold tracking-widest text-ink-soft">MY ART, YOUR OBJECT</p>
            <h1 className="text-3xl leading-tight font-black sm:text-4xl">
              졸업전시가 끝나도
              <br />
              작품은 계속 걸려 있어야 하니까.
            </h1>
            <p className="max-w-md text-ink-soft">
              학교 인증을 받은 작가의 졸업작품을 첫 원화로. 회화부터 가구·의상·조각·금속공예까지, 전시장에서 본 그 작품을
              작가에게서 직접 소장하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="#collection" size="lg">작품 둘러보기</ButtonLink>
              <ButtonLink href="/join" size="lg" variant="secondary">작가 입점 신청</ButtonLink>
            </div>
          </div>
          {hero && (
            <Link href={`/works/${hero.id}`} className="group flex flex-col gap-3">
              <div className="border-[10px] border-ink bg-paper p-4 shadow-sm transition-shadow duration-300 group-hover:shadow-[0_20px_40px_-16px_rgb(27_42_85/0.45)]">
                <div className="overflow-hidden">
                  <WorkImage src={hero.images[0]} alt={hero.title} className="aspect-[5/4] w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <b>{heroArtist?.name}</b> <span className="link-sweep">「{hero.title}」</span> · {formatPrice(hero.price)}
                </span>
                <VerifiedBadge method={heroArtist?.verifiedBy ?? null} schoolName={heroArtist?.schoolId ? schoolById.get(heroArtist.schoolId)?.shortName : null} />
              </div>
            </Link>
          )}
        </Container>
      </section>

      {stories.length > 0 && (
        <section className="border-b border-line">
          <Container className="py-6">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {stories.map(({ e, phase }) => (
                <Link key={e.id} href={`/exhibitions/${e.id}`} className="flex w-60 shrink-0 flex-col gap-1 rounded-md border border-line bg-paper p-4 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-md">
                  <span className={phase === "ongoing" ? "text-xs font-bold text-dot" : "text-xs font-bold text-ink-soft"}>
                    {phase === "ongoing" ? "● " : ""}
                    {PHASE_LABEL[phase]}
                  </span>
                  <span className="line-clamp-2 font-semibold">{e.title}</span>
                  <span className="text-xs text-ink-soft">{formatPeriod(e.startDate, e.endDate)} · {e.venue}</span>
                </Link>
              ))}
              <Link href="/exhibitions" className="flex w-40 shrink-0 items-center justify-center rounded-md border border-line bg-paper p-4 text-sm font-semibold hover:border-ink">
                전체 전시 일정 →
              </Link>
              <Link href="/exhibitions/apply" className="flex w-60 shrink-0 flex-col justify-center gap-1 rounded-md border border-dashed border-ink/40 p-4 hover:border-ink">
                <span className="text-xs font-bold text-ink-soft">+ 전시 등록</span>
                <span className="font-semibold">우리 학과 졸업·과제전시도 올려 보세요</span>
              </Link>
            </div>
          </Container>
        </section>
      )}

      <section id="collection" className="scroll-mt-20">
        <Container className="flex flex-col gap-8 py-12">
          <div className="flex flex-col gap-1 border-b border-ink pb-4">
            <h2 className="text-2xl font-bold">졸업전시 컬렉션</h2>
            <p className="text-sm text-ink-soft">빨간 점은 예약 중이거나 판매가 끝난 작품입니다.</p>
          </div>
          {works.length === 0 ? (
            <EmptyState title="첫 작품을 준비하고 있어요">졸업전시 시즌에 맞춰 작품이 올라옵니다.</EmptyState>
          ) : (
            <CollectionBrowser works={works} artists={artists} schools={schools} />
          )}
        </Container>
      </section>
    </>
  );
}
