import { SchoolForm } from "@/features/admin/school-form";
import { AdminHeading, Table, Td } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function AdminSchools() {
  const db = await adminDb();
  return (
    <>
      <AdminHeading title="학교" description="학교 이름은 소개용입니다. 학교 로고와 교표는 쓰지 않아요 (공식 서비스로 오해받지 않도록)." />
      <div className="mb-6"><SchoolForm /></div>
      <Table head={["학교", "짧은 이름", "작가", "인증 작가", "전시"]}>
        {db.schools.map((s) => {
          const artists = db.artists.filter((a) => a.schoolId === s.id);
          return (
            <tr key={s.id}>
              <Td className="font-semibold">{s.name}</Td>
              <Td>{s.shortName}</Td>
              <Td>{artists.length}</Td>
              <Td>{artists.filter((a) => a.verifiedBy).length}</Td>
              <Td>{db.exhibitions.filter((e) => e.schoolId === s.id).length}</Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
