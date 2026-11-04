import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { MyWorkForm } from "@/features/account/my-work-form";
import { myArtist } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "작품 올리기", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Form />
    </Suspense>
  );
}

async function Form() {
  const me = await requireUser("/account/sell/works");
  const artist = await myArtist(me.id);
  if (!artist) redirect("/account/sell");
  const { categories } = await getCatalog();
  return (
    <AccountShell me={me} mode="sell">
      <Section title="작품 올리기">
        <p className="text-sm text-ink-soft">올린 작품은 운영자가 사진과 정보를 확인한 뒤 공개돼요. 보통 하루 안에 확인해요.</p>
        <MyWorkForm categories={categories.filter((c) => c.visible)} />
      </Section>
    </AccountShell>
  );
}
