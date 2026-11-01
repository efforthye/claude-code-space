import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { WorkCard } from "@/features/catalog/work-card";
import { exhibitionPhase, getCatalog, indexById, PHASE_LABEL } from "@/lib/data/catalog";
import { formatPeriod } from "@/lib/format";

export default function ExhibitionPage(props: PageProps<"/exhibitions/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">전시를 불러오는 중…</Container>}>
      <ExhibitionDetail params={props.params} />
    </Suspense>
  );
}

async function ExhibitionDetail({ params }: { params: PageProps<"/exhibitions/[id]">["params"] }) {
  const { id } = await params;
  const { exhibitions, works, artists, schools, today } = await getCatalog();
  const e = exhibitions.find((x) => x.id === id);
  if (!e) notFound();
  const artistById = indexById(artists);
  const schoolById = indexById(schools);
  const shown = works.filter((w) => w.exhibitionId === e.id);
  const participants = [...new Set(shown.map((w) => w.artistId))].map((aid) => artistById.get(aid)?.name).filter(Boolean);
  const phase = exhibitionPhase(e, today);

  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-3 border-b border-ink pb-6">
        <Badge tone={phase === "ongoing" ? "dot" : "neutral"} className="w-fit">{PHASE_LABEL[phase]}</Badge>
        <h1 className="text-3xl font-black">{e.title}</h1>
        <dl className="grid max-w-2xl grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
          <dt className="text-ink-soft">기간</dt><dd>{formatPeriod(e.startDate, e.endDate)}</dd>
          <dt className="text-ink-soft">장소</dt>
          <dd className="flex flex-col">
            <span>{e.place ? e.venue : [e.schoolId && schoolById.get(e.schoolId)?.name, e.venue].filter(Boolean).join(" ")}</span>
            {e.place?.address && <span className="text-xs text-ink-soft">{e.place.address}</span>}
            <a
              href={e.place?.url ?? `https://map.kakao.com/link/search/${encodeURIComponent([e.schoolId && schoolById.get(e.schoolId)?.name, e.place?.name ?? e.venue].filter(Boolean).join(" "))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-sweep mt-0.5 w-fit text-xs font-semibold"
            >
              지도에서 보기 ↗
            </a>
          </dd>
          {e.hours && (<><dt className="text-ink-soft">관람 시간</dt><dd>{e.hours}</dd></>)}
          {e.opening && (<><dt className="text-ink-soft">오프닝</dt><dd>{e.opening}</dd></>)}
        </dl>
        {e.description && <p className="max-w-2xl leading-relaxed whitespace-pre-line">{e.description}</p>}
        {e.note && <p className="max-w-2xl rounded-sm bg-warn-soft p-3 text-xs text-warn">{e.note}</p>}
        {e.source && (
          <p className="text-xs text-ink-soft">
            일정 출처: <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="underline">{e.source.label}</a>. MAYO는 이 전시의 주최자가 아니며, 방문 전 학과 공식 계정에서 확인하세요.
          </p>
        )}
        {participants.length > 0 && <p className="text-sm text-ink-soft">참여 작가: {participants.join(", ")}</p>}
        {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">전시 안내 페이지</a>}
      </header>
      {shown.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5">
            <p className="font-bold">이 전시에 참여하는 작가인가요?</p>
            <p className="text-sm text-ink-soft">입점하면 작품을 무료로 촬영해 드리고, 전시가 끝난 뒤에도 작품을 소개해요. 판매는 원하는 작품만.</p>
            <ButtonLink href="/join" variant="secondary" className="w-fit">작가 입점 신청</ButtonLink>
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5">
            <p className="font-bold">졸업준비위원회, 학생회라면</p>
            <p className="text-sm text-ink-soft">전시 전체를 온라인 전시 페이지로 만들고 QR 캡션 라벨을 드려요. 이번 시즌 무료예요.</p>
            <ButtonLink href="/exhibitions/apply" variant="secondary" className="w-fit">전시 등록 신청</ButtonLink>
          </div>
        </div>
      ) : (
        <div className="columns-2 gap-6 md:columns-3 lg:columns-4">
          {shown.map((w) => {
            const a = artistById.get(w.artistId);
            return <WorkCard key={w.id} work={w} artist={a} school={a?.schoolId ? schoolById.get(a.schoolId) : undefined} />;
          })}
        </div>
      )}
    </Container>
  );
}
