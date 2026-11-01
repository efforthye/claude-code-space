import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MetaLine } from "@/components/ui/meta-line";
import { WorkCard } from "@/features/catalog/work-card";
import { exhibitionPhase, getCatalog, PHASE_LABEL, type ExhibitionPhase } from "@/lib/data/catalog";
import { categoryLabel } from "@/lib/domain/rules";
import { formatPeriod } from "@/lib/format";

const PHASE_STYLE: Record<ExhibitionPhase, string> = {
  ongoing: "bg-aurora text-white",
  upcoming: "bg-violet/10 text-violet",
  ended: "bg-ink/5 text-ink-soft",
};
const PHASE_ORDER: Record<ExhibitionPhase, number> = { ongoing: 0, upcoming: 1, ended: 2 };

export default function SchoolPage(props: PageProps<"/schools/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">학교를 불러오는 중…</Container>}>
      <SchoolDetail params={props.params} />
    </Suspense>
  );
}

async function SchoolDetail({ params }: { params: PageProps<"/schools/[id]">["params"] }) {
  const { id } = await params;
  const { schools, artists, works, exhibitions, categories, today } = await getCatalog();
  const school = schools.find((s) => s.id === id);
  if (!school) notFound();
  const ofSchool = artists.filter((a) => a.schoolId === school.id);
  const artistIds = new Set(ofSchool.map((a) => a.id));
  const schoolWorks = works.filter((w) => artistIds.has(w.artistId));
  const shows = exhibitions
    .filter((e) => e.schoolId === school.id)
    .map((e) => ({ e, phase: exhibitionPhase(e, today) }))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.e.startDate.localeCompare(b.e.startDate));
  const byId = new Map(ofSchool.map((a) => [a.id, a]));

  return (
    <Container className="flex flex-col gap-12 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/schools" className="link-sweep w-fit text-sm text-ink-soft">← 학교 전체</Link>
        <h1 className="text-4xl font-bold">{school.name}</h1>
        <p className="text-sm text-ink-soft">
          <MetaLine>
            {`작가 ${ofSchool.length}명`}
            {`인증 작가 ${ofSchool.filter((a) => a.verifiedBy).length}명`}
            {`작품 ${schoolWorks.length}점`}
            {`이번 시즌 전시 ${shows.filter((s) => s.phase !== "ended").length}개`}
          </MetaLine>
        </p>
        <p className="text-xs text-ink-soft">MAYO는 학교의 공식 서비스가 아니며, 학생 작가가 직접 입점한 작품을 소개합니다.</p>
      </header>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-[36px] leading-none">Works</h2>
        {schoolWorks.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-xl p-10 text-center">
            <p className="font-semibold">아직 {school.shortName} 작가의 작품이 없어요</p>
            <p className="text-sm text-ink-soft">이 학교 학생이거나 졸업생이라면 첫 작가가 되어 주세요.</p>
            <ButtonLink href="/join">작가 입점 신청</ButtonLink>
          </div>
        ) : (
          <div className="columns-2 gap-6 md:columns-3 lg:columns-4">
            {schoolWorks.map((w) => (
              <WorkCard key={w.id} work={w} artist={byId.get(w.artistId)} school={school} mediumLabel={categoryLabel(categories, w.medium)} />
            ))}
          </div>
        )}
      </section>

      {shows.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-[36px] leading-none">Exhibitions</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shows.map(({ e, phase }) => (
              <li key={e.id}>
                <Link href={`/exhibitions/${e.id}`} className="glass flex h-full flex-col gap-2 rounded-[22px] p-5 transition-[translate,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/80">
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PHASE_STYLE[phase]}`}>{PHASE_LABEL[phase]}</span>
                  <span className="leading-snug font-semibold">{e.title.replace(`${school.shortName} `, "")}</span>
                  <span className="text-[13px] text-ink-soft"><MetaLine>{formatPeriod(e.startDate, e.endDate)}{e.venue}</MetaLine></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ofSchool.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-[36px] leading-none">Artists</h2>
          <ul className="flex flex-wrap gap-3">
            {ofSchool.map((a) => (
              <li key={a.id}>
                <Link href={`/artists/${a.id}`} className="glass flex items-center gap-3 rounded-full py-2 pr-5 pl-2 transition-colors hover:bg-white">
                  <Avatar src={a.avatar} name={a.name} className="size-10 text-[22px]" />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-xs text-ink-soft">{a.department ?? "학과 미기재"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
