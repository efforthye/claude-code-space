import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { groupLabel, VERIFY_LABEL } from "@/lib/domain/rules";

export default async function AdminArtists() {
  const db = await adminDb();
  const school = new Map(db.schools.map((s) => [s.id, s.name]));
  return (
    <>
      <AdminHeading title="작가" description="학교 인증은 학교 이메일, 학생증/증명서, 졸전 명단 중 하나로 직접 확인한 뒤 표시해요." action={<ButtonLink href="/admin/artists/new">작가 추가</ButtonLink>} />
      <Table head={["작가", "구분", "학교와 학과", "학교 인증", "작품"]}>
        {db.artists.map((a) => (
          <tr key={a.id} className="hover:bg-mist/50">
            <Td><Link href={`/admin/artists/${a.id}`} className="font-semibold underline underline-offset-2">{a.name}</Link></Td>
            <Td>{groupLabel(db.artistGroups, a.status)}</Td>
            <Td className="text-ink-soft">{[a.schoolId && school.get(a.schoolId), a.department].filter(Boolean).join(", ") || "소속 없음"}</Td>
            <Td>{a.verifiedBy ? <Badge tone="ok">{VERIFY_LABEL[a.verifiedBy]}</Badge> : <Badge tone="warn">미인증</Badge>}</Td>
            <Td>{db.works.filter((w) => w.artistId === a.id).length}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
