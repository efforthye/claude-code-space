import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { WorkImage } from "@/features/catalog/work-image";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { categoryLabel, coverImage, KIND_LABEL, WORK_STATUS_LABEL } from "@/lib/domain/rules";
import { formatPrice, formatSize } from "@/lib/format";

export default async function AdminWorks() {
  const db = await adminDb();
  const artistName = new Map(db.artists.map((a) => [a.id, a.name]));
  const works = [...db.works].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <AdminHeading title="작품" description={`전체 ${works.length}점`} action={<ButtonLink href="/admin/works/new">작품 등록</ButtonLink>} />
      <Table head={["", "작품", "작가", "매체와 구분", "크기", "가격", "상태"]}>
        {works.map((w) => (
          <tr key={w.id} className="hover:bg-mist/50">
            <Td><WorkImage src={coverImage(w)} alt="" className="size-12 rounded-sm" /></Td>
            <Td><Link href={`/admin/works/${w.id}`} className="font-semibold underline underline-offset-2">{w.title}</Link>{w.edition && <span className="text-ink-soft">, {w.edition}</span>}</Td>
            <Td>{artistName.get(w.artistId)}</Td>
            <Td className="text-ink-soft">{categoryLabel(db.categories, w.medium)}, {KIND_LABEL[w.kind]}</Td>
            <Td className="text-ink-soft">{formatSize(w.widthCm, w.heightCm, w.depthCm)}</Td>
            <Td>{formatPrice(w.price)}</Td>
            <Td><Badge tone={w.status === "available" ? "ok" : w.status === "hidden" ? "neutral" : "dot"}>{WORK_STATUS_LABEL[w.status]}</Badge></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
