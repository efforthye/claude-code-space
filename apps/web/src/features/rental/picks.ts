import "server-only";
import type { Catalog } from "@/lib/data/catalog";
import { coverImage, isRentable, rentalDeposit, rentalMonthly, showsRental } from "@/lib/domain/rules";
import type { RentalPick } from "./forms";

/** 렌탈 목록에 보일 작품 (예시 포함, 예시는 신청 버튼 대신 표시만) */
export function rentableWorks(catalog: Pick<Catalog, "works">) {
  return catalog.works.filter((w) => showsRental(w));
}

export function toPick(catalog: Pick<Catalog, "works" | "artists">, id: string): RentalPick | null {
  const w = catalog.works.find((x) => x.id === id);
  if (!w || !isRentable(w)) return null;
  return {
    id: w.id,
    title: w.title,
    artistName: catalog.artists.find((a) => a.id === w.artistId)?.name ?? "",
    monthly: rentalMonthly(w.price),
    deposit: rentalDeposit(w.price),
    cover: coverImage(w) ?? null,
  };
}
