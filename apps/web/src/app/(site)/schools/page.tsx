import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { exhibitionPhase, getCatalog, PHASE_LABEL, type ExhibitionPhase } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "학교" };

const byKo = new Intl.Collator("ko");

const PHASE_STYLE: Record<ExhibitionPhase, string> = {
  ongoing: "bg-aurora text-white",
  upcoming: "bg-violet/10 text-violet",
  ended: "bg-ink/5 text-ink-soft",
};

export default async function SchoolsPage() {
  const { schools, artists, works, exhibitions, today } = await getCatalog();
  const rows = [...schools]
    .sort((a, b) => byKo.compare(a.name, b.name)) // 가나다순
    .map((s) => {
      const ofSchool = artists.filter((a) => a.schoolId === s.id);
      const ids = new Set(ofSchool.map((a) => a.id));
      const shows = exhibitions
        .filter((e) => e.schoolId === s.id)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      return {
        s,
        artists: ofSchool.length,
        verified: ofSchool.filter((a) => a.verifiedBy).length,
        works: works.filter((w) => ids.has(w.artistId)).length,
        shows: shows.map((e) => ({ e, phase: exhibitionPhase(e, today) })),
        live: shows.filter((e) => exhibitionPhase(e, today) !== "ended").length,
      };
    });

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="Schools" title="학교별 보기" description="MAYO는 각 학교의 공식 서비스가 아니며, 학생 작가가 직접 입점한 작품을 소개합니다." />
      {rows.length === 0 ? (
        <EmptyState title="등록된 학교가 없어요" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.s.id} className="glass flex min-w-0 flex-col gap-3 rounded-lg p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">{r.s.name}</h2>
                {r.live > 0 && <span className="rounded-full bg-pink px-2.5 py-0.5 text-[11px] font-semibold text-white">전시 {r.live}</span>}
              </div>
              {r.artists > 0 ? (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-xs text-ink-soft">작가</dt><dd className="text-xl font-bold">{r.artists}</dd></div>
                  <div><dt className="text-xs text-ink-soft">인증 작가</dt><dd className="text-xl font-bold">{r.verified}</dd></div>
                  <div><dt className="text-xs text-ink-soft">작품</dt><dd className="text-xl font-bold">{r.works}</dd></div>
                </dl>
              ) : (
                <p className="flex items-center justify-between gap-2 text-sm text-ink-soft">
                  아직 입점한 작가가 없어요
                  <Link href="/join" className="link-sweep shrink-0 font-semibold text-violet">입점하기 →</Link>
                </p>
              )}
              {r.shows.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-ink/10 pt-3 text-sm">
                  {r.shows.slice(0, 3).map(({ e, phase }) => (
                    <li key={e.id} className="flex min-w-0 items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PHASE_STYLE[phase]}`}>{PHASE_LABEL[phase]}</span>
                      <Link href={`/exhibitions/${e.id}`} className="link-sweep block min-w-0 truncate">{e.title.replace(`${r.s.shortName} `, "")}</Link>
                    </li>
                  ))}
                  {r.shows.length > 3 && <li className="text-xs text-ink-soft">외 {r.shows.length - 3}개 전시</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <section className="glass flex flex-col items-start gap-4 rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">우리 학교가 없나요?</h2>
          <p className="text-sm text-ink-soft">작가로 입점하거나 졸업전시를 등록하면 학교가 목록에 추가돼요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/join">작가 입점 신청</ButtonLink>
          <ButtonLink href="/exhibitions/apply" variant="secondary">전시 등록 신청</ButtonLink>
        </div>
      </section>
    </Container>
  );
}
