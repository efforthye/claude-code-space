"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/container";
import { KIND_LABEL, MEDIUM_LABEL } from "@/lib/domain/rules";
import { MEDIA, WORK_KINDS, type Artist, type Medium, type School, type Work, type WorkKind } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { WorkCard } from "./work-card";

const PRICE_BANDS = [
  { id: "all", label: "전체 가격", min: 0, max: Infinity },
  { id: "u10", label: "10만 원 미만", min: 0, max: 100_000 },
  { id: "10-30", label: "10–30만 원", min: 100_000, max: 300_000 },
  { id: "30-50", label: "30–50만 원", min: 300_000, max: 500_000 },
  { id: "o50", label: "50만 원 이상", min: 500_000, max: Infinity },
] as const;

type Filters = {
  medium: Medium | "all";
  school: string;
  kind: WorkKind | "all";
  price: (typeof PRICE_BANDS)[number]["id"];
  availableOnly: boolean;
};

export function CollectionBrowser({ works, artists, schools }: { works: Work[]; artists: Artist[]; schools: School[] }) {
  const [f, setF] = useState<Filters>({ medium: "all", school: "all", kind: "all", price: "all", availableOnly: false });
  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const schoolById = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const presentMedia = useMemo(() => MEDIA.filter((m) => works.some((w) => w.medium === m)), [works]);

  const shown = works.filter((w) => {
    const band = PRICE_BANDS.find((b) => b.id === f.price)!;
    const artist = artistById.get(w.artistId);
    return (
      (f.medium === "all" || w.medium === f.medium) &&
      (f.kind === "all" || w.kind === f.kind) &&
      (f.school === "all" || artist?.schoolId === f.school) &&
      w.price >= band.min &&
      w.price < band.max &&
      (!f.availableOnly || w.status === "available")
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
        <Chip active={f.medium === "all"} onClick={() => setF({ ...f, medium: "all" })}>전체</Chip>
        {presentMedia.map((m) => (
          <Chip key={m} active={f.medium === m} onClick={() => setF({ ...f, medium: m })}>
            {MEDIUM_LABEL[m]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterSelect value={f.school} onChange={(school) => setF({ ...f, school })} label="학교">
          <option value="all">모든 학교</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </FilterSelect>
        <FilterSelect value={f.kind} onChange={(kind) => setF({ ...f, kind: kind as Filters["kind"] })} label="작품 구분">
          <option value="all">모든 구분</option>
          {WORK_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </FilterSelect>
        <FilterSelect value={f.price} onChange={(price) => setF({ ...f, price: price as Filters["price"] })} label="가격대">
          {PRICE_BANDS.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </FilterSelect>
        <label className="ml-1 flex items-center gap-1.5">
          <input type="checkbox" className="size-4 accent-violet" checked={f.availableOnly} onChange={(e) => setF({ ...f, availableOnly: e.target.checked })} />
          판매 중인 작품만
        </label>
        <span className="ml-auto text-ink-soft">{shown.length}점</span>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="조건에 맞는 작품이 없어요">필터를 바꿔 보세요.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((w) => {
            const artist = artistById.get(w.artistId);
            return <WorkCard key={w.id} work={w} artist={artist} school={artist?.schoolId ? schoolById.get(artist.schoolId) : undefined} />;
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-full px-4 text-sm font-medium transition-colors active:scale-[0.97]",
        active ? "bg-ink text-white" : "bg-white/70 text-ink-soft backdrop-blur hover:bg-white hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-full border border-ink/10 bg-white/70 px-3 text-sm backdrop-blur">
      {children}
    </select>
  );
}
