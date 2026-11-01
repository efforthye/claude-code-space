"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/container";
import { cn } from "@/lib/cn";
import type { ExhibitionPhase } from "@/lib/data/catalog";
import { formatPeriod } from "@/lib/format";
import { MetaLine } from "@/components/ui/meta-line";

export type ExhibitionRow = {
  id: string;
  title: string;
  schoolId: string | null;
  schoolShort: string | null;
  venue: string;
  startDate: string;
  endDate: string;
  phase: ExhibitionPhase;
  works: number;
};

const PHASES: { id: ExhibitionPhase | "now"; label: string }[] = [
  { id: "now", label: "다가오는 전시" },
  { id: "ongoing", label: "진행 중" },
  { id: "upcoming", label: "예정" },
  { id: "ended", label: "종료" },
];

export function ExhibitionList({ rows, schools }: { rows: ExhibitionRow[]; schools: { id: string; name: string }[] }) {
  const [phase, setPhase] = useState<ExhibitionPhase | "now">("now");
  const [school, setSchool] = useState("all");
  const [q, setQ] = useState("");
  const shown = rows.filter(
    (r) =>
      (phase === "now" ? r.phase !== "ended" : r.phase === phase) &&
      (school === "all" || r.schoolId === school) &&
      (q === "" || `${r.title} ${r.venue}`.includes(q.trim())),
  );
  const withExhibitions = schools.filter((s) => rows.some((r) => r.schoolId === s.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={phase === p.id}
            onClick={() => setPhase(p.id)}
            className={cn("h-8 rounded-sm border px-3 font-medium", phase === p.id ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink-soft")}
          >
            {p.label}
          </button>
        ))}
        <select aria-label="학교" value={school} onChange={(e) => setSchool(e.target.value)} className="h-8 rounded-sm border border-line bg-paper px-2">
          <option value="all">모든 학교</option>
          {withExhibitions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="학과, 전시명, 장소 검색"
          className="h-8 min-w-48 flex-1 rounded-sm border border-line bg-paper px-2"
        />
        <span className="text-ink-soft">{shown.length}개</span>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="조건에 맞는 전시가 없어요" />
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/exhibitions/${r.id}`} className="group flex flex-col gap-1 py-4 transition-colors hover:bg-paper sm:flex-row sm:items-center sm:gap-5 sm:px-2">
                <Badge tone={r.phase === "ongoing" ? "dot" : r.phase === "upcoming" ? "ink" : "neutral"} className="w-fit shrink-0">
                  {r.phase === "ongoing" ? "진행 중" : r.phase === "upcoming" ? "예정" : "종료"}
                </Badge>
                <span className="flex-1 font-semibold"><span className="link-sweep">{r.title}</span></span>
                <span className="text-sm text-ink-soft sm:text-right">
                  <MetaLine>{formatPeriod(r.startDate, r.endDate)}{r.venue}</MetaLine>
                  {r.works > 0 && <b className="ml-1 text-ink">, 작품 {r.works}점</b>}
                </span>
                <span aria-hidden className="hidden text-ink opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-1 group-hover:opacity-100 sm:inline">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
