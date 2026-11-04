import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { MyWorkForm } from "@/features/account/my-work-form";
import { myArtist, myWork } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "작품 고치기", robots: { index: false } };

export default function Page(props: PageProps<"/account/sell/works/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Form params={props.params} />
    </Suspense>
  );
}

async function Form({ params }: { params: PageProps<"/account/sell/works/[id]">["params"] }) {
  const me = await requireUser("/account/sell/works");
  const artist = await myArtist(me.id);
  if (!artist) redirect("/account/sell");
  const { categories } = await getCatalog();
  const { id } = await params;
  const work = await myWork(artist.id, id);
  if (!work) notFound();
  if (work.status === "reserved" || work.status === "sold") redirect("/account/sell/works");
  return (
    <AccountShell me={me} mode="sell">
      <Section title="작품 고치기">
        <p className="text-sm text-ink-soft">고친 내용은 바로 반영돼요.</p>
        <MyWorkForm work={work} categories={categories.filter((c) => c.visible)} />
      </Section>
    </AccountShell>
  );
}
