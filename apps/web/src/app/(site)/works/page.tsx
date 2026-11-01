import type { Metadata } from "next";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { CollectionBrowser } from "@/features/catalog/collection-browser";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "작품" };

export default async function WorksPage() {
  const { works, artists, schools, categories } = await getCatalog();
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="The collection" title="작품" description="빨간 점은 예약 중이거나 판매가 끝난 작품이에요." />
      {works.length === 0 ? (
        <EmptyState title="첫 작품을 준비하고 있어요">졸업전시 시즌에 맞춰 작품이 올라옵니다.</EmptyState>
      ) : (
        <CollectionBrowser works={works} artists={artists} schools={schools} categories={categories} />
      )}
    </Container>
  );
}
