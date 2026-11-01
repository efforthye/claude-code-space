"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/cn";
import { groupLabel, lifespan } from "@/lib/domain/rules";
import type { Artist, ArtistGroup, School } from "@/lib/domain/types";
import { MetaLine } from "@/components/ui/meta-line";

/** "all", "verified", "commission" 또는 작가 구분 코드 (관리자에서 관리) */
type Filter = string;

export function ArtistList({ artists, schools, groups, workCounts }: { artists: Artist[]; schools: School[]; groups: ArtistGroup[]; workCounts: Record<string, number> }) {
  const [filter, setFilter] = useState<Filter>("all");
  // 작가가 한 명도 없는 구분은 칩으로 띄우지 않는다
  const present = new Set(artists.map((a) => a.status));
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "verified", label: "✓ 인증 작가" },
    ...groups.filter((g) => g.visible && present.has(g.id)).map((g) => ({ id: g.id, label: g.label })),
    { id: "commission", label: "주문제작 가능" },
  ];
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const shown = artists.filter((a) =>
    filter === "all" ? true : filter === "verified" ? !!a.verifiedBy : filter === "commission" ? a.acceptsCommission : a.status === filter,
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn("h-8 rounded-sm border px-3 text-sm font-medium", filter === f.id ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink-soft")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a) => {
          const school = a.schoolId ? schoolById.get(a.schoolId) : undefined;
          return (
            <li key={a.id}>
              <Link href={`/artists/${a.id}`} className="flex h-full flex-col gap-2 rounded-md border border-line bg-paper p-4 transition-[border-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold">
                    {a.name}
                    {a.deathYear != null && <span className="ml-2 text-xs font-medium text-ink-soft">{lifespan(a)}</span>}
                  </span>
                  <span className="text-xs text-ink-soft">작품 {workCounts[a.id] ?? 0}점</span>
                </div>
                <span className="text-sm text-ink-soft">{school || a.department ? <MetaLine>{school?.name}{a.department}</MetaLine> : "소속 없음"}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{groupLabel(groups, a.status)}</Badge>
                  {a.acceptsCommission && <Badge tone="clay">주문제작</Badge>}
                  <VerifiedBadge method={a.verifiedBy} schoolName={school?.shortName} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
