import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CollectionBrowser } from "@/features/catalog/collection-browser";
import { HeroCollage, type HeroWork } from "@/features/catalog/hero-collage";
import { coverImage, MEDIUM_LABEL } from "@/lib/domain/rules";
import { exhibitionPhase, getCatalog, indexById } from "@/lib/data/catalog";
import { formatPeriod, formatPrice } from "@/lib/format";

export default async function HomePage() {
  const { works, artists, schools, exhibitions, today } = await getCatalog();
  // 판매 중인 작품 후보 — 4점은 브라우저에서 방문마다 무작위로 고른다
  const available = works.filter((w) => w.status === "available");
  const artistById = indexById(artists);
  const schoolById = indexById(schools);
  const heroWorks: HeroWork[] = available
    .slice(0, 40)
    .map((w) => {
      const a = artistById.get(w.artistId);
      return {
        id: w.id,
        title: w.title,
        cover: coverImage(w),
        medium: MEDIUM_LABEL[w.medium],
        artist: a?.name ?? "",
        verifiedSchool: a?.verifiedBy && a.schoolId ? (schoolById.get(a.schoolId)?.shortName ?? null) : null,
        price: formatPrice(w.price),
      };
    });
  const shows = exhibitions
    .map((e) => ({ e, phase: exhibitionPhase(e, today) }))
    .filter((x) => x.phase !== "ended")
    .sort((a, b) => a.e.startDate.localeCompare(b.e.startDate))
    .slice(0, 6);
  const upcomingCount = exhibitions.filter((e) => exhibitionPhase(e, today) !== "ended").length;

  return (
    <>
      <Container className="grid items-center gap-12 pt-10 pb-16 md:grid-cols-2 md:pt-16">
        <div className="flex flex-col gap-6">
          <Eyebrow>Graduation show 2026</Eyebrow>
          <h1 className="font-display text-[68px] leading-[0.92] tracking-tight sm:text-[104px]">
            My art,
            <br />
            <i className="text-aurora pr-2">your object.</i>
          </h1>
          <p className="text-lg text-ink-soft">졸업전시장에서 본 그 작품을, 첫 원화로.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="#collection" size="lg">Explore works</ButtonLink>
            <ButtonLink href="/join" size="lg" variant="secondary">For artists</ButtonLink>
          </div>
        </div>

        <HeroCollage works={heroWorks} />
      </Container>

      {shows.length > 0 && (
        <Container className="flex flex-col gap-5 pb-16">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[44px] leading-none">
              On view <i>now</i>
            </h2>
            <Link href="/exhibitions" className="link-sweep text-sm font-medium">
              All {upcomingCount} shows →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shows.map(({ e, phase }) => (
              <Link
                key={e.id}
                href={`/exhibitions/${e.id}`}
                className="glass group flex flex-col gap-2 rounded-[22px] p-5 transition-[translate,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white/80"
              >
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white ${phase === "ongoing" ? "bg-pink" : "bg-violet"}`}>
                  {phase === "ongoing" ? "Now" : "Soon"}
                </span>
                <span className="text-[17px] leading-snug font-semibold">{e.title}</span>
                <span className="text-[13px] text-ink-soft">
                  {formatPeriod(e.startDate, e.endDate)}, {e.venue}
                </span>
              </Link>
            ))}
            <Link
              href="/exhibitions/apply"
              className="flex flex-col justify-center gap-1 rounded-[22px] border border-dashed border-violet/40 p-5 transition-colors hover:border-violet hover:bg-white/50"
            >
              <span className="text-xs font-semibold text-violet">+ 전시 등록</span>
              <span className="font-semibold">우리 학과 전시도 올려 보세요</span>
            </Link>
          </div>
        </Container>
      )}

      <section id="collection" className="scroll-mt-24">
        <Container className="flex flex-col gap-6 pb-16">
          <h2 className="font-display text-[44px] leading-none">The collection</h2>
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
