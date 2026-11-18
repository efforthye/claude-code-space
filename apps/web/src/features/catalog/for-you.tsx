"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/container";
import type { Artist, Category, School, Work } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { WorkCard } from "./work-card";

/**
 * 취향 맞춤 추천 (기능 19). 가입 없이 세 가지만 고르면 작품을 점수순으로 보여 준다.
 * 고른 값은 주소(?medium=&space=&budget=)에 남아서 공유하거나 다시 열 수 있다.
 */
const SPACES = [
  { id: "small", label: "책상, 선반 (긴 변 40cm 이하)", max: 40 },
  { id: "medium", label: "작은 벽 (긴 변 80cm 이하)", max: 80 },
  { id: "large", label: "넓은 벽 (80cm 넘어도 좋아요)", max: Infinity },
] as const;
const BUDGETS = [
  { id: "10", label: "10만 원까지", max: 100_000 },
  { id: "30", label: "30만 원까지", max: 300_000 },
  { id: "50", label: "50만 원까지", max: 500_000 },
  { id: "any", label: "상관없어요", max: Infinity },
] as const;

type Scored = { work: Work; score: number; reasons: string[] };

export function ForYou({ works, artists, schools, categories }: { works: Work[]; artists: Artist[]; schools: School[]; categories: Category[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const medium = params.get("medium") ?? "";
  const space = SPACES.find((s) => s.id === params.get("space"));
  const budget = BUDGETS.find((b) => b.id === params.get("budget"));

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const schoolById = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const labelOf = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);
  const media = categories.filter((c) => c.visible && works.some((w) => w.medium === c.id));

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };

  const picked = Boolean(medium || space || budget);
  const scored: Scored[] = works
    .filter((w) => w.status === "available")
    .map((w) => {
      const reasons: string[] = [];
      let score = 0;
      if (medium && w.medium === medium) { score += 3; reasons.push(`좋아하는 ${labelOf.get(w.medium) ?? "매체"}`); }
      const longSide = Math.max(w.widthCm, w.heightCm);
      if (space && longSide <= space.max) { score += 2; reasons.push("공간에 맞는 크기"); }
      if (budget && w.price <= budget.max) { score += 2; reasons.push("예산 안"); }
      if (artistById.get(w.artistId)?.verifiedBy) { score += 0.5; reasons.push("학교 인증 작가"); }
      return { work: w, score, reasons };
    })
    // 매체를 골랐으면 그 매체만, 아니면 공간이나 예산 중 하나는 맞는 작품만
    .filter((s) => !picked || (medium ? s.work.medium === medium : s.score >= 2))
    .sort((a, b) => b.score - a.score || a.work.price - b.work.price);

  return (
    <div className="flex flex-col gap-8">
      <section className="glass flex flex-col gap-5 rounded-2xl p-5 sm:p-7">
        <Question n={1} title="어떤 작품이 끌리나요?">
          {media.map((c) => (
            <Chip key={c.id} active={medium === c.id} onClick={() => set("medium", c.id)}>{c.label}</Chip>
          ))}
        </Question>
        <Question n={2} title="어디에 두실 건가요?">
          {SPACES.map((s) => (
            <Chip key={s.id} active={space?.id === s.id} onClick={() => set("space", s.id)}>{s.label}</Chip>
          ))}
        </Question>
        <Question n={3} title="예산은 어느 정도인가요?">
          {BUDGETS.map((b) => (
            <Chip key={b.id} active={budget?.id === b.id} onClick={() => set("budget", b.id)}>{b.label}</Chip>
          ))}
        </Question>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{picked ? `맞춤 추천 ${scored.length}점` : "판매 중인 작품"}</h2>
        {scored.length === 0 ? (
          <EmptyState title="조건에 맞는 작품이 아직 없어요">예산이나 공간을 하나 넓혀 보세요.</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {scored.slice(0, 12).map(({ work, reasons }) => {
              const artist = artistById.get(work.artistId);
              return (
                <li key={work.id} className="flex flex-col gap-2">
                  <WorkCard work={work} artist={artist} school={artist?.schoolId ? schoolById.get(artist.schoolId) : undefined} mediumLabel={labelOf.get(work.medium) ?? ""} />
                  {picked && reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {reasons.map((r) => (
                        <span key={r} className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-semibold text-violet">{r}</span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Question({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-semibold">{n}) {title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200",
        active ? "bg-ink text-white" : "bg-white/80 text-ink hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
