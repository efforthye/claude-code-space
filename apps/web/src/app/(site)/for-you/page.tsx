import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageHeading } from "@/components/ui/container";
import { ForYou } from "@/features/catalog/for-you";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "취향 맞춤 추천" };

export default async function ForYouPage() {
  const { works, artists, schools, categories } = await getCatalog();
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="For you" title="취향 맞춤 추천" description="세 가지만 고르면 처음 소장하기 좋은 작품을 골라 드려요. 가입하지 않아도 돼요." />
      <Suspense fallback={<div className="h-96" />}>
        <ForYou works={works} artists={artists} schools={schools} categories={categories} />
      </Suspense>
    </Container>
  );
}
