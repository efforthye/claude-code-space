import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container, EmptyState } from "@/components/ui/container";
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
        <p className="text-sm text-ink-soft">{formatPeriod(e.startDate, e.endDate)} · {e.venue}</p>
        {e.description && <p className="max-w-2xl leading-relaxed">{e.description}</p>}
        {participants.length > 0 && <p className="text-sm text-ink-soft">참여 작가: {participants.join(", ")}</p>}
        {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">전시 안내 페이지</a>}
      </header>
      {shown.length === 0 ? (
        <EmptyState title="아직 등록된 출품작이 없어요" />
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((w) => {
            const a = artistById.get(w.artistId);
            return <WorkCard key={w.id} work={w} artist={a} school={a?.schoolId ? schoolById.get(a.schoolId) : undefined} />;
          })}
        </div>
      )}
    </Container>
  );
}
