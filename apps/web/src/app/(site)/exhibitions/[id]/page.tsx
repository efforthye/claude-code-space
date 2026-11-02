import { notFound } from "next/navigation";
import { FreeBadge } from "@/components/ui/free-badge";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { WorkCard } from "@/features/catalog/work-card";
import { exhibitionCountdown, exhibitionPhase, getCatalog, indexById, PHASE_LABEL } from "@/lib/data/catalog";
import Link from "next/link";
import type { Exhibition } from "@/lib/domain/types";
import { MetaLine } from "@/components/ui/meta-line";
import { mapQuery } from "@/features/places/map-links";
import { categoryLabel } from "@/lib/domain/rules";
import { formatPeriod } from "@/lib/format";
import { mapLinks } from "@/features/places/map-links";

export default function ExhibitionPage(props: PageProps<"/exhibitions/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">전시를 불러오는 중…</Container>}>
      <ExhibitionDetail params={props.params} />
    </Suspense>
  );
}

async function ExhibitionDetail({ params }: { params: PageProps<"/exhibitions/[id]">["params"] }) {
  const { id } = await params;
  const { exhibitions, works, artists, schools, today, categories } = await getCatalog();
  const e = exhibitions.find((x) => x.id === id);
  if (!e) notFound();
  const artistById = indexById(artists);
  const schoolById = indexById(schools);
  const shown = works.filter((w) => w.exhibitionId === e.id);
  const participants = [...new Set(shown.map((w) => w.artistId))].map((aid) => artistById.get(aid)?.name).filter(Boolean);
  const phase = exhibitionPhase(e, today);
  const countdown = exhibitionCountdown(e, today);
  const school = e.schoolId ? schoolById.get(e.schoolId) : undefined;
  const live = (x: typeof e) => exhibitionPhase(x, today) !== "ended";
  // 같은 학교의 다른 전시 (진행 중, 예정 먼저)
  const sameSchool = exhibitions
    .filter((x) => x.id !== e.id && x.schoolId === e.schoolId && e.schoolId)
    .sort((a, b) => Number(live(b)) - Number(live(a)) || a.startDate.localeCompare(b.startDate))
    .slice(0, 6);
  // 같은 건물에서 열리는 다른 학교 전시 (지도 검색어로 건물을 맞춘다)
  const here = mapQuery(e.venue, e.place ?? null, school?.name);
  const sameVenue = exhibitions
    .filter((x) => x.id !== e.id && x.schoolId !== e.schoolId && live(x) && mapQuery(x.venue, x.place ?? null, x.schoolId ? schoolById.get(x.schoolId)?.name : null) === here)
    .slice(0, 6);

  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-3 border-b border-ink pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={phase === "ongoing" ? "dot" : "neutral"} className="w-fit">{PHASE_LABEL[phase]}</Badge>
          {countdown && <span className="text-sm font-semibold text-violet">{countdown}</span>}
        </div>
        <h1 className="text-3xl font-black">{e.title}</h1>
        {school && (
          <p className="text-sm">
            <MetaLine>
              <Link href={`/schools/${school.id}`} className="link-sweep font-semibold">{school.name}</Link>
              {e.department}
              {e.participantCount ? `${e.participantCount}명 참여` : null}
            </MetaLine>
          </p>
        )}
        <dl className="grid max-w-2xl grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
          <dt className="text-ink-soft">기간</dt><dd>{formatPeriod(e.startDate, e.endDate)}</dd>
          <dt className="text-ink-soft">장소</dt>
          <dd className="flex flex-col">
            <span>{e.place ? e.venue : [e.schoolId && schoolById.get(e.schoolId)?.name, e.venue].filter(Boolean).join(" ")}</span>
            {e.place?.address && <span className="text-xs text-ink-soft">{e.place.address}</span>}
            <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="지도에서 보기">
              {mapLinks(e.venue, e.place ?? null, e.schoolId ? schoolById.get(e.schoolId)?.name : null).map((m) => (
                <a
                  key={m.id}
                  href={m.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 hover:bg-white"
                >
                  {m.label} ↗
                </a>
              ))}
            </div>
          </dd>
          {e.hours && (<><dt className="text-ink-soft">관람 시간</dt><dd>{e.hours}</dd></>)}
          {e.opening && (<><dt className="text-ink-soft">오프닝</dt><dd>{e.opening}</dd></>)}
          {e.instagram && (<><dt className="text-ink-soft">공식 계정</dt><dd><a href={`https://instagram.com/${e.instagram}`} target="_blank" rel="noopener noreferrer" className="link-sweep font-semibold">@{e.instagram}</a></dd></>)}
        </dl>
        {e.poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.poster} alt={`${e.title} 포스터`} className="max-h-[70vh] w-auto max-w-full self-start shadow-lg sm:max-w-sm" />
        )}
        {e.description && <p className="max-w-2xl leading-relaxed whitespace-pre-line">{e.description}</p>}
        {e.note && <p className="max-w-2xl rounded-sm bg-warn-soft p-3 text-xs text-warn">{e.note}</p>}
        {e.source && (
          <p className="text-xs text-ink-soft">
            일정 출처: <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="underline">{e.source.label}</a>. MAYO는 이 전시의 주최자가 아니며, 방문 전 학과 공식 계정에서 확인하세요.
          </p>
        )}
        {participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft">참여 작가</span>
            {participants.map((name) => <span key={name} className="glass rounded-full px-3 py-1 text-xs font-semibold">{name}</span>)}
          </div>
        )}
        {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">전시 안내 페이지</a>}
      </header>
      {shown.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-3 glass rounded-lg p-5">
            <p className="font-bold">이 전시에 참여하는 작가인가요?</p>
            <p className="text-sm text-ink-soft">입점하면 작품을 무료로 촬영해 드리고, 전시가 끝난 뒤에도 작품을 소개해요. 판매는 원하는 작품만.</p>
            <ButtonLink href="/join" variant="secondary" className="w-fit">작가 입점 신청</ButtonLink>
          </div>
          <div className="flex flex-col gap-3 glass rounded-lg p-5">
            <p className="flex flex-wrap items-center gap-2 font-bold">졸업준비위원회, 학생회라면 <FreeBadge /></p>
            <p className="text-sm text-ink-soft">전시 전체를 온라인 전시 페이지로 만들고 QR 캡션 라벨을 드려요.</p>
            <ButtonLink href="/exhibitions/apply" variant="secondary" className="w-fit">전시 등록 신청</ButtonLink>
          </div>
        </div>
      ) : (
        <div className="columns-2 gap-6 md:columns-3 lg:columns-4">
          {shown.map((w) => {
            const a = artistById.get(w.artistId);
            return <WorkCard key={w.id} work={w} artist={a} school={a?.schoolId ? schoolById.get(a.schoolId) : undefined} mediumLabel={categoryLabel(categories, w.medium)} />;
          })}
        </div>
      )}

      {sameSchool.length > 0 && school && (
        <RelatedShows title={`${school.shortName}의 다른 전시`} shows={sameSchool} today={today} />
      )}
      {sameVenue.length > 0 && <RelatedShows title="같은 곳에서 열리는 다른 전시" shows={sameVenue} today={today} />}
    </Container>
  );
}

function RelatedShows({ title, shows, today }: { title: string; shows: Exhibition[]; today: string }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((x) => {
          const p = exhibitionPhase(x, today);
          return (
            <li key={x.id}>
              <Link href={`/exhibitions/${x.id}`} className="glass flex h-full flex-col gap-1.5 rounded-[20px] p-4 transition-[translate,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/80">
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p === "ongoing" ? "bg-aurora text-white" : p === "upcoming" ? "bg-violet/10 text-violet" : "bg-ink/5 text-ink-soft"}`}>{PHASE_LABEL[p]}</span>
                <span className="leading-snug font-semibold">{x.title}</span>
                <span className="text-xs text-ink-soft"><MetaLine>{formatPeriod(x.startDate, x.endDate)}{x.venue}</MetaLine></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
