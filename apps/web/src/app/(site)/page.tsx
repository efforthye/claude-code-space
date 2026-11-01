import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { WorkTile } from "@/features/catalog/work-card";
import { HeroVisual } from "@/features/catalog/hero-visual";
import { categoryLabel } from "@/lib/domain/rules";
import { exhibitionPhase, getCatalog, indexById } from "@/lib/data/catalog";
import { formatPeriod } from "@/lib/format";

export default async function HomePage() {
  const { works, artists, schools, exhibitions, categories, today } = await getCatalog();
  // 판매 중인 작품 후보, 4점은 브라우저에서 방문마다 무작위로 고른다
  const available = works.filter((w) => w.status === "available");
  const artistById = indexById(artists);
  const schoolById = indexById(schools);
  const shows = exhibitions
    .map((e) => ({ e, phase: exhibitionPhase(e, today) }))
    .filter((x) => x.phase !== "ended")
    .sort((a, b) => a.e.startDate.localeCompare(b.e.startDate))
    .slice(0, 6);
  // 메인은 짧게: 최근 판매 중 작품 4점만, 전체는 /works
  const newest = available.slice(0, 4);
  const schoolsWithShows = new Set(exhibitions.filter((e) => exhibitionPhase(e, today) !== "ended").map((e) => e.schoolId)).size;
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
            <ButtonLink href="/works" size="lg">Explore works</ButtonLink>
            <ButtonLink href="/join" size="lg" variant="secondary">For artists</ButtonLink>
          </div>
        </div>

        <HeroVisual shows={upcomingCount} schools={schoolsWithShows} artists={artists.filter((a) => a.verifiedBy).length} />
      </Container>

      {shows.length > 0 && (
        <Container className="flex flex-col gap-5 pb-16">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[44px] leading-none">
              On view <i>now</i>
            </h2>
            <Link href="/exhibitions" className="link-sweep text-sm font-medium">
              전체 {upcomingCount}개 →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shows.map(({ e, phase }) => (
              <Link
                key={e.id}
                href={`/exhibitions/${e.id}`}
                className="glass flex flex-col gap-2 rounded-[22px] p-5 transition-[translate,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/80"
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

      {newest.length > 0 && (
        <Container className="flex flex-col gap-5 pb-16">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[40px] leading-none">
              New <i>arrivals</i>
            </h2>
            <Link href="/works" className="link-sweep text-sm font-medium">
              작품 전체 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-4">
            {newest.map((w) => {
              const a = artistById.get(w.artistId);
              return (
                <WorkTile
                  key={w.id}
                  work={w}
                  artist={a}
                  school={a?.schoolId ? schoolById.get(a.schoolId) : undefined}
                  mediumLabel={categoryLabel(categories, w.medium)}
                />
              );
            })}
          </div>
        </Container>
      )}
    </>
  );
}
