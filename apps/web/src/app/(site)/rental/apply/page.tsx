import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { RentalForm } from "@/features/rental/forms";
import { toPick } from "@/features/rental/picks";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "렌탈 신청", robots: { index: false } };

export default function RentalApplyPage(props: PageProps<"/rental/apply">) {
  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <PageHeading eyebrow="Rental" title="렌탈 신청" description="신청을 받으면 작가와 설치 일정을 맞춰 연락드려요. 계약을 확정하기 전에는 돈을 받지 않아요." />
      <Suspense fallback={<p className="text-ink-soft">불러오는 중…</p>}>
        <Apply searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}

async function Apply({ searchParams }: { searchParams: PageProps<"/rental/apply">["searchParams"] }) {
  const sp = await searchParams;
  const ids = ([] as string[]).concat(sp.work ?? []).slice(0, 30);
  const catalog = await getCatalog();
  const picks = ids.map((id) => toPick(catalog, id)).filter((p) => p !== null);
  if (picks.length === 0) {
    return (
      <EmptyState title="렌탈할 작품을 먼저 골라 주세요">
        <Link href="/rental" className="underline underline-offset-4">렌탈할 수 있는 작품 보기</Link>
      </EmptyState>
    );
  }
  return <RentalForm picks={picks} audience={sp.for === "business" ? "business" : "personal"} />;
}
