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
  };
}

export function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((r) => [r.id, r]));
}
