"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
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
  const [query, setQuery] = useState("");
  const [schoolId, setSchoolId] = useState("all");
  const [sort, setSort] = useState<"works" | "name" | "recent">("works");
  // 작가가 한 명도 없는 구분은 칩으로 띄우지 않는다
  const present = new Set(artists.map((a) => a.status));
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "verified", label: "✓ 인증 작가" },
    ...groups.filter((g) => g.visible && present.has(g.id)).map((g) => ({ id: g.id, label: g.label })),
    { id: "commission", label: "주문제작 가능" },
  ];
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  // 작가가 있는 학교만, 가나다순
  const schoolOptions = schools.filter((s) => artists.some((a) => a.schoolId === s.id)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const q = query.trim().toLowerCase();
  const shown = artists
    .filter((a) =>
      filter === "all" ? true : filter === "verified" ? !!a.verifiedBy : filter === "commission" ? a.acceptsCommission : a.status === filter,
    )
    .filter((a) => schoolId === "all" || a.schoolId === schoolId)
    .filter((a) => {
      if (!q) return true;
      const school = a.schoolId ? schoolById.get(a.schoolId) : undefined;
      return [a.name, a.department, school?.name, school?.shortName, a.bio].some((v) => v?.toLowerCase().includes(q));
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "ko")
        : sort === "recent"
          ? b.createdAt.localeCompare(a.createdAt)
          : (workCounts[b.id] ?? 0) - (workCounts[a.id] ?? 0) || a.name.localeCompare(b.name, "ko"),
    );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="작가명, 학교, 학과 검색"
          aria-label="작가 검색"
          className="h-10 min-w-0 flex-1 basis-56 rounded-full border border-ink/12 bg-white/80 px-4 text-sm backdrop-blur transition-[border-color,box-shadow] focus:border-violet focus:shadow-[0_0_0_4px_rgb(107_60_255/0.12)] focus:outline-none"
        />
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="학교" className="h-10 rounded-full border border-ink/12 bg-white/80 px-4 text-sm">
          <option value="all">모든 학교</option>
          {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="정렬" className="h-10 rounded-full border border-ink/12 bg-white/80 px-4 text-sm">
          <option value="works">작품 많은 순</option>
          <option value="name">가나다순</option>
          <option value="recent">최근 입점순</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-medium transition-colors duration-200",
              filter === f.id ? "border-ink bg-ink text-paper" : "border-ink/10 bg-white/70 text-ink-soft hover:bg-white hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-sm text-ink-soft" aria-live="polite">작가 {shown.length}명</p>
      {shown.length === 0 && <p className="glass rounded-lg p-8 text-center text-sm text-ink-soft">조건에 맞는 작가가 없어요. 검색어나 필터를 바꿔 보세요.</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a) => {
          const school = a.schoolId ? schoolById.get(a.schoolId) : undefined;
          return (
            <li key={a.id}>
              <Link href={`/artists/${a.id}`} className="glass flex h-full flex-col gap-3 rounded-[22px] p-5 transition-[translate,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <Avatar src={a.avatar} name={a.name} className="size-12 text-[28px]" />
                  <span className="min-w-0 flex-1 text-lg font-bold">
                    {a.name}
                    {a.deathYear != null && <span className="ml-2 text-xs font-medium text-ink-soft">{lifespan(a)}</span>}
                  </span>
                  <span className="text-xs text-ink-soft">작품 {workCounts[a.id] ?? 0}점</span>
                </div>
                <span className="text-sm text-ink-soft">{school || a.department ? <MetaLine>{school?.name}{a.department}</MetaLine> : "소속 없음"}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {a.sample && <Badge>예시 작가</Badge>}
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
