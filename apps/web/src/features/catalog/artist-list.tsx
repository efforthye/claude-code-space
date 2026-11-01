"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/cn";
import { ARTIST_STATUS_LABEL } from "@/lib/domain/rules";
import type { Artist, ArtistStatus, School } from "@/lib/domain/types";

type Filter = "all" | "verified" | ArtistStatus | "commission";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "verified", label: "✓ 인증 작가" },
  { id: "student", label: "재학생" },
  { id: "graduate", label: "졸업생" },
  { id: "aspiring", label: "미대 지망생" },
  { id: "general", label: "일반 작가" },
  { id: "commission", label: "주문제작 가능" },
];

export function ArtistList({ artists, schools, workCounts }: { artists: Artist[]; schools: School[]; workCounts: Record<string, number> }) {
  const [filter, setFilter] = useState<Filter>("all");
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
              <Link href={`/artists/${a.id}`} className="flex h-full flex-col gap-2 rounded-md border border-line bg-paper p-4 hover:border-ink">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold">{a.name}</span>
                  <span className="text-xs text-ink-soft">작품 {workCounts[a.id] ?? 0}점</span>
                </div>
                <span className="text-sm text-ink-soft">{[school?.name, a.department].filter(Boolean).join(" · ") || "소속 없음"}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{ARTIST_STATUS_LABEL[a.status]}</Badge>
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
