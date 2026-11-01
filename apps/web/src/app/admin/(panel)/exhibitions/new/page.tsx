import { ExhibitionForm } from "@/features/admin/exhibition-form";
import { AdminHeading } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function NewExhibition() {
  const db = await adminDb();
  return (
    <>
      <AdminHeading title="전시 추가" />
      <ExhibitionForm schools={db.schools} />
    </>
  );
}
