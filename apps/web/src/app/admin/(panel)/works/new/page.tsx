import { WorkForm } from "@/features/admin/work-form";
import { AdminHeading } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function NewWork() {
  const db = await adminDb();
  return (
    <>
      <AdminHeading title="작품 등록" />
      <WorkForm artists={db.artists} exhibitions={db.exhibitions} />
    </>
  );
}
