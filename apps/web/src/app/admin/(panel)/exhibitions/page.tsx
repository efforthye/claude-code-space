import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { formatPeriod } from "@/lib/format";

export default async function AdminExhibitions() {
  const db = await adminDb();
  const school = new Map(db.schools.map((s) => [s.id, s.shortName]));
  return (
    <>
      <AdminHeading title="전시" action={<ButtonLink href="/admin/exhibitions/new">전시 추가</ButtonLink>} />
      <Table head={["전시", "학교", "기간", "장소", "출품작", ""]}>
        {[...db.exhibitions].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((e) => (
          <tr key={e.id} className="hover:bg-mist/50">
            <Td><Link href={`/admin/exhibitions/${e.id}`} className="font-semibold underline underline-offset-2">{e.title}</Link></Td>
            <Td>{e.schoolId ? school.get(e.schoolId) : "—"}</Td>
            <Td className="text-ink-soft">{formatPeriod(e.startDate, e.endDate)}</Td>
            <Td className="text-ink-soft">{e.venue}</Td>
            <Td>{db.works.filter((w) => w.exhibitionId === e.id).length}</Td>
            <Td><Link href={`/admin/qr?exhibition=${e.id}`} className="text-xs underline">QR 라벨</Link></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
