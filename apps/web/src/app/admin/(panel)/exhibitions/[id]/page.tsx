import { notFound } from "next/navigation";
import { ExhibitionForm } from "@/features/admin/exhibition-form";
import { AdminHeading } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function EditExhibition(props: PageProps<"/admin/exhibitions/[id]">) {
  const { id } = await props.params;
  const db = await adminDb();
  const exhibition = db.exhibitions.find((e) => e.id === id);
  if (!exhibition) notFound();
  return (
    <>
      <AdminHeading title={exhibition.title} />
      <ExhibitionForm exhibition={exhibition} schools={db.schools} />
    </>
  );
}
