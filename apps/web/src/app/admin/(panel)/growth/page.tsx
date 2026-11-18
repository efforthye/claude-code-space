import Link from "next/link";
import { AdminHeading, Stat } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

/**
 * 작가 성장 분석 (기능 21). 작가를 구분(재학생, 졸업생 …)별로, 작품을 시기(재학 중, 졸업작품, 졸업 이후)별로 나누고
 * 쌓인 데이터로 신진작가 후보를 점수순으로 올린다. 최종 선정은 운영자가 한다.
 */
type Stage = "재학 중 작품" | "졸업작품" | "졸업 이후";

function workStage(year: number, gradYear: number | null): Stage | null {
  if (!gradYear) return null;
  if (year < gradYear) return "재학 중 작품";
  if (year === gradYear) return "졸업작품";
  return "졸업 이후";
}

export default async function GrowthPage() {
  const db = await adminDb();
  const thisYear = new Date().getFullYear();
  const groups = [...db.artistGroups].sort((a, b) => a.order - b.order);
  const soldIds = new Set(db.orders.filter((o) => o.paidAt && o.status !== "cancelled").flatMap((o) => o.items.map((i) => i.workId)));

  const rows = db.artists.map((a) => {
    const works = db.works.filter((w) => w.artistId === a.id);
    const stages = { "재학 중 작품": 0, 졸업작품: 0, "졸업 이후": 0 } as Record<Stage, number>;
    for (const w of works) {
      const s = workStage(w.year, a.gradYear);
      if (s) stages[s] += 1;
    }
    const sold = works.filter((w) => soldIds.has(w.id) || w.status === "sold").length;
    const graduated = a.gradYear != null && a.gradYear < thisYear;
    // 신진작가 후보 점수: 졸업 이후에도 작업을 이어 가고(신작), 실제로 팔리고, 학교 인증이 된 작가를 먼저
    const score = stages["졸업 이후"] * 2 + sold * 3 + (a.verifiedBy ? 1 : 0) + (graduated ? 1 : 0);
    return { a, works: works.length, stages, sold, graduated, score };
  });

  const byGroup = groups.map((g) => ({ g, n: db.artists.filter((a) => a.status === g.id).length }));
  const stageTotals = (["재학 중 작품", "졸업작품", "졸업 이후"] as Stage[]).map((s) => ({ s, n: rows.reduce((n, r) => n + r.stages[s], 0) }));
  const candidates = rows.filter((r) => r.score >= 2).sort((x, y) => y.score - x.score).slice(0, 10);

  return (
    <>
      <AdminHeading title="작가 성장 분석" description="작가는 구분별로, 작품은 졸업연도를 기준으로 시기별로 나눠요. 신진작가 후보는 점수순 추천이고, 최종 선정은 운영자가 해요." />
      <h2 className="mb-3 font-bold">작가 구분</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {byGroup.map(({ g, n }) => (
          <Stat key={g.id} label={g.label} value={`${n}명`} href="/admin/artists" />
        ))}
      </div>
      <h2 className="mt-8 mb-3 font-bold">작품 시기 (작품 연도와 졸업연도 비교)</h2>
      <div className="grid grid-cols-3 gap-3">
        {stageTotals.map(({ s, n }) => (
          <Stat key={s} label={s} value={`${n}점`} href="/admin/works" />
        ))}
      </div>
      <h2 className="mt-8 mb-3 font-bold">신진작가 후보</h2>
      {candidates.length === 0 ? (
        <p className="text-sm text-ink-soft">아직 후보가 없어요. 졸업 이후 신작과 판매가 쌓이면 여기에 올라와요.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-paper text-sm">
          {candidates.map((r, i) => (
            <li key={r.a.id}>
              <Link href={`/admin/artists/${r.a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-mist">
                <span>
                  <b>{i + 1}) {r.a.name}</b>
                  <span className="text-ink-soft">, {groups.find((g) => g.id === r.a.status)?.label ?? r.a.status}{r.a.gradYear ? `, ${r.a.gradYear} 졸업${r.graduated ? "" : " 예정"}` : ""}</span>
                </span>
                <span className="text-ink-soft">
                  작품 {r.works}점 (재학 {r.stages["재학 중 작품"]}, 졸업작품 {r.stages.졸업작품}, 졸업 이후 {r.stages["졸업 이후"]}), 판매 {r.sold}점, <b className="text-ink">점수 {r.score}</b>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
