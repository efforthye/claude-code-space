import { ArtistForm } from "@/features/admin/artist-form";
import { AdminHeading } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function NewArtist() {
  const db = await adminDb();
  return (
    <>
      <AdminHeading title="작가 추가" />
      <ArtistForm schools={db.schools} groups={[...db.artistGroups].sort((a, b) => a.order - b.order)} />
    </>
  );
}
