import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkForm } from "@/features/admin/work-form";
import { AdminHeading, Saved } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";

export default async function EditWork(props: PageProps<"/admin/works/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const db = await adminDb();
  const work = db.works.find((w) => w.id === id);
  if (!work) notFound();
  return (
    <>
      <AdminHeading title={`「${work.title}」`} action={<Link href={`/works/${work.id}`} target="_blank" className="text-sm underline">사이트에서 보기 ↗</Link>} />
      <Saved show={sp.saved === "1"} />
      <WorkForm key={work.updatedAt} work={work} artists={db.artists} exhibitions={db.exhibitions} categories={[...db.categories].sort((a, b) => a.order - b.order)} />
    </>
  );
}
