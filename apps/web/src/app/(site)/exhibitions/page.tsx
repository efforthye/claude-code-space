import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { exhibitionPhase, getCatalog, indexById, PHASE_LABEL } from "@/lib/data/catalog";
import { formatPeriod } from "@/lib/format";

export const metadata: Metadata = { title: "전시" };

export default async function ExhibitionsPage() {
  const { exhibitions, works, schools, today } = await getCatalog();
  const schoolById = indexById(schools);
  const order = { ongoing: 0, upcoming: 1, ended: 2 } as const;
  const rows = exhibitions
    .map((e) => ({ e, phase: exhibitionPhase(e, today), count: works.filter((w) => w.exhibitionId === e.id).length }))
    .sort((a, b) => order[a.phase] - order[b.phase] || b.e.startDate.localeCompare(a.e.startDate));

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="Exhibitions" title="졸업전시 · 과제전" />
      {rows.length === 0 ? (
        <EmptyState title="등록된 전시가 없어요" />
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {rows.map(({ e, phase, count }) => (
            <li key={e.id}>
              <Link href={`/exhibitions/${e.id}`} className="flex flex-col gap-1 py-5 hover:bg-paper sm:flex-row sm:items-center sm:gap-6 sm:px-2">
                <Badge tone={phase === "ongoing" ? "dot" : phase === "upcoming" ? "ink" : "neutral"} className="w-fit">{PHASE_LABEL[phase]}</Badge>
                <span className="flex-1 font-semibold">{e.title}</span>
                <span className="text-sm text-ink-soft">
                  {formatPeriod(e.startDate, e.endDate)} · {e.venue}
                  {e.schoolId && ` · ${schoolById.get(e.schoolId)?.shortName}`} · 출품작 {count}점
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
