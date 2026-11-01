import type { Metadata } from "next";
import { Container, PageHeading } from "@/components/ui/container";
import { ArtistList } from "@/features/catalog/artist-list";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "작가" };

export default async function ArtistsPage() {
  const { artists, schools, works } = await getCatalog();
  const workCounts: Record<string, number> = {};
  for (const w of works) workCounts[w.artistId] = (workCounts[w.artistId] ?? 0) + 1;
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="Artists" title="작가" description="학교 인증 딱지는 운영자가 학교 이메일, 학생증, 졸업전시 명단으로 확인한 작가에게만 붙습니다." />
      <ArtistList artists={artists} schools={schools} workCounts={workCounts} />
    </Container>
  );
}
