import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { WorkTile } from "@/features/catalog/work-card";
import { HeroVisual } from "@/features/catalog/hero-visual";
import { categoryLabel, coverImage } from "@/lib/domain/rules";
import { exhibitionPhase, getCatalog, indexById } from "@/lib/data/catalog";
import { formatPeriod } from "@/lib/format";
import { MetaLine } from "@/components/ui/meta-line";
import { SealIcon } from "@/components/ui/verified-badge";
import { WorkImage } from "@/features/catalog/work-image";

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
  // 매체별 바로가기: 관리자가 보이게 둔 분류, 작품이 있는 것 먼저
  const media = categories
    .filter((c) => c.visible)
    .map((c) => ({ c, count: works.filter((w) => w.medium === c.id).length, cover: works.find((w) => w.medium === c.id && coverImage(w)) }))
    .sort((a, b) => Number(b.count > 0) - Number(a.count > 0))
    .slice(0, 8);
  // 이번 시즌 전시가 있는 학교, 전시 많은 순
  const seasonSchools = schools
    .map((s) => ({ s, n: exhibitions.filter((e) => e.schoolId === s.id && exhibitionPhase(e, today) !== "ended").length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.s.name.localeCompare(b.s.name, "ko"));

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
          <p className="text-lg text-ink-soft">졸업전시와 과제전 작품을 작가에게 직접 사는 곳이에요.</p>
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
                  <MetaLine>{formatPeriod(e.startDate, e.endDate)}{e.venue}</MetaLine>
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
      {media.length > 0 && (
        <Container className="flex flex-col gap-5 pb-16">
          <SectionTitle title={<>Shop by <i>medium</i></>} href="/works" link="모든 매체 →" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.map(({ c, count, cover }) => (
              <Link
                key={c.id}
                href={`/works?medium=${c.id}`}
                className="group glass relative flex aspect-[5/4] flex-col justify-end overflow-hidden rounded-[22px] p-4 transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                {cover && (
                  <WorkImage
                    src={coverImage(cover)}
                    alt=""
                    className="absolute inset-0 size-full transition-[scale] duration-500 group-hover:scale-105"
                  />
                )}
                <span aria-hidden className={cover ? "absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" : "bg-aurora absolute inset-0 opacity-15"} />
                <span className={`relative text-lg font-bold ${cover ? "text-white" : ""}`}>{c.label}</span>
                <span className={`relative text-xs ${cover ? "text-white/85" : "text-ink-soft"}`}>{count > 0 ? `작품 ${count}점` : "준비 중"}</span>
              </Link>
            ))}
          </div>
        </Container>
      )}

      <Container className="flex flex-col gap-5 pb-16">
        <SectionTitle title={<>How it <i>works</i></>} />
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            { n: "01", t: "전시에서 작품 찾기", d: "전시장 캡션의 QR이나 MAYO 전시 페이지에서 그 작품을 바로 찾아요." },
            { n: "02", t: "학교 인증 확인", d: "학교 이메일, 학생증, 졸업전시 명단으로 운영자가 직접 확인한 작가예요." },
            { n: "03", t: "주문하고 받기", d: "입금이 확인되면 작가와 일정을 맞춰 택배, 전문 운송, 직접 수령으로 받아요." },
          ].map((step) => (
            <li key={step.n} className="glass flex flex-col gap-2 rounded-[22px] p-6">
              <span className="font-display text-aurora text-4xl italic">{step.n}</span>
              <span className="text-lg font-bold">{step.t}</span>
              <span className="text-sm leading-relaxed text-ink-soft">{step.d}</span>
            </li>
          ))}
        </ol>
      </Container>

      <Container className="flex flex-col gap-5 pb-16">
        <SectionTitle title={<>Why <i>MAYO</i></>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "학교 인증 딱지", d: "소속을 서류로 확인한 작가에게만 붙어요." },
            { t: "작품 보증서", d: "구매 후 요청하면 QR로 진위를 확인할 수 있는 보증서를 드려요." },
            { t: "미술품 전문 운송", d: "조각, 가구처럼 큰 작품은 견적을 먼저 보여 드리고 옮겨요." },
            { t: "입금 확인 후 진행", d: "입금이 확인된 뒤에 배송이 시작되고, 받은 날부터 7일 안에 철회할 수 있어요." },
          ].map((x) => (
            <div key={x.t} className="glass flex flex-col gap-2 rounded-[22px] p-5">
              <SealIcon className="size-7" />
              <span className="font-bold">{x.t}</span>
              <span className="text-sm leading-relaxed text-ink-soft">{x.d}</span>
            </div>
          ))}
        </div>
      </Container>

      {seasonSchools.length > 0 && (
        <Container className="flex flex-col gap-5 pb-16">
          <SectionTitle title={<>Schools this <i>season</i></>} href="/schools" link={`${seasonSchools.length}개 학교 →`} />
          <div className="flex flex-wrap gap-2">
            {seasonSchools.slice(0, 18).map(({ s, n }) => (
              <Link
                key={s.id}
                href={`/schools/${s.id}`}
                className="glass flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 text-sm font-semibold transition-colors duration-200 hover:bg-white"
              >
                {s.name}
                <span className="bg-aurora rounded-full px-2 py-0.5 text-[11px] text-white">{n}</span>
              </Link>
            ))}
            {seasonSchools.length > 18 && (
              <Link href="/schools" className="flex items-center rounded-full px-4 py-1.5 text-sm font-semibold text-violet">
                외 {seasonSchools.length - 18}곳
              </Link>
            )}
          </div>
        </Container>
      )}

      <Container className="pb-8">
        <section className="relative isolate flex flex-col gap-6 overflow-hidden rounded-[28px] bg-ink p-8 text-white sm:p-12 md:flex-row md:items-end md:justify-between">
          <span aria-hidden className="bg-aurora absolute -top-24 -right-16 -z-10 size-80 rounded-full opacity-60 blur-3xl" />
          <span aria-hidden className="absolute -bottom-24 left-10 -z-10 size-64 rounded-full bg-violet/50 blur-3xl" />
          <div className="flex max-w-xl flex-col gap-3">
            <span className="font-display text-xl text-white/80 italic">For artists</span>
            <h2 className="text-3xl leading-tight font-bold sm:text-4xl">작품을 MAYO에 올려 보세요</h2>
            <p className="text-white/80">졸업작품, 과제작, 개인 작업 모두 올릴 수 있어요. 작품 촬영과 전시 페이지 제작을 도와드리고, 판매할 작품은 작가가 직접 고릅니다. 재학생, 졸업생, 미대 지망생 누구나 신청할 수 있어요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/join" size="lg">작가 입점 신청</ButtonLink>
            <Link href="/exhibitions/apply" className="flex h-12 items-center rounded-full border border-white/30 px-5 font-semibold transition-colors hover:bg-white/10">
              전시 등록 신청
            </Link>
          </div>
        </section>
      </Container>
    </>
  );
}

function SectionTitle({ title, href, link }: { title: React.ReactNode; href?: string; link?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[40px] leading-none">{title}</h2>
      {href && (
        <Link href={href} className="link-sweep text-sm font-medium">
          {link}
        </Link>
      )}
    </div>
  );
}
