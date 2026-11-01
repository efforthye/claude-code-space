import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistForm } from "@/features/admin/artist-form";
import { AdminHeading, Saved } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function EditArtist(props: PageProps<"/admin/artists/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const db = await adminDb();
  const artist = db.artists.find((a) => a.id === id);
  if (!artist) notFound();
  return (
    <>
      <AdminHeading title={artist.name} action={<Link href={`/artists/${artist.id}`} target="_blank" className="text-sm underline">사이트에서 보기 ↗</Link>} />
      <Saved show={sp.saved === "1"} />
      <ArtistForm key={artist.verifiedAt ?? artist.id} artist={artist} schools={db.schools} groups={[...db.artistGroups].sort((a, b) => a.order - b.order)} />
    </>
  );
}
