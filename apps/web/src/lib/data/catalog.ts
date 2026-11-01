import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isListed } from "@/lib/domain/rules";
import type { Artist, Exhibition, School, Work } from "@/lib/domain/types";
import { store } from "./store";

/** Cache tags. Mutations call `updateTag` with these (see features/admin/actions). */
export const TAG = {
  catalog: "catalog",
} as const;

export type Catalog = {
  schools: School[];
  artists: Artist[];
  exhibitions: Exhibition[];
  works: Work[];
  /** 캐시가 만들어진 날짜(YYYY-MM-DD, KST). 전시 진행 상태 판단에 쓴다. */
  today: string;
};

/**
 * Everything the public site shows, cached as one unit. The catalogue is small
 * (hundreds of works per season), so one tag invalidated on every admin edit
 * is simpler than per-entity tags and still cheap.
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.catalog);
  const db = await store.read();
  return {
    schools: db.schools,
    artists: db.artists,
    exhibitions: db.exhibitions,
    works: db.works.filter(isListed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    today: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
  };
}

export function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((r) => [r.id, r]));
}

export type ExhibitionPhase = "ongoing" | "upcoming" | "ended";

export function exhibitionPhase(e: Exhibition, today: string): ExhibitionPhase {
  if (today < e.startDate) return "upcoming";
  if (today > e.endDate) return "ended";
  return "ongoing";
}

export const PHASE_LABEL: Record<ExhibitionPhase, string> = {
  ongoing: "진행 중",
  upcoming: "예정",
  ended: "종료",
};
