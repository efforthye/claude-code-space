import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container, EmptyState } from "@/components/ui/container";
import { VerificationCard } from "@/components/ui/verified-badge";
import { WorkCard } from "@/features/catalog/work-card";
import { getCatalog, indexById } from "@/lib/data/catalog";
import { ARTIST_STATUS_LABEL } from "@/lib/domain/rules";

export default function ArtistPage(props: PageProps<"/artists/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">작가를 불러오는 중…</Container>}>
      <ArtistDetail params={props.params} />
    </Suspense>
  );
}

async function ArtistDetail({ params }: { params: PageProps<"/artists/[id]">["params"] }) {
  const { id } = await params;
  const { artists, schools, works, exhibitions } = await getCatalog();
  const artist = artists.find((a) => a.id === id);
  if (!artist) notFound();
  const school = artist.schoolId ? indexById(schools).get(artist.schoolId) : undefined;
  const own = works.filter((w) => w.artistId === artist.id);
  const shownIn = exhibitions.filter((e) => own.some((w) => w.exhibitionId === e.id));

  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-3 border-b border-ink pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{ARTIST_STATUS_LABEL[artist.status]}</Badge>
          {artist.acceptsCommission && <Badge tone="clay">주문제작 가능</Badge>}
        </div>
        <h1 className="text-3xl font-black">{artist.name}</h1>
        <p className="text-sm text-ink-soft">
          {[school?.name, artist.department, artist.gradYear && `${artist.gradYear}년 졸업${artist.status === "student" ? " 예정" : ""}`].filter(Boolean).join(" · ")}
        </p>
        <div className="max-w-xl">
          <VerificationCard method={artist.verifiedBy} verifiedAt={artist.verifiedAt} schoolName={school?.name} department={artist.department} statusLabel={ARTIST_STATUS_LABEL[artist.status]} />
        </div>
        {artist.bio && <p className="max-w-2xl leading-relaxed">{artist.bio}</p>}
        <div className="flex gap-4 text-sm font-semibold">
          {artist.instagram && <a href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Instagram</a>}
          {artist.portfolioUrl && <a href={artist.portfolioUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">포트폴리오</a>}
        </div>
        {shownIn.length > 0 && <p className="text-sm text-ink-soft">참여 전시: {shownIn.map((e) => e.title).join(", ")}</p>}
      </header>
      {own.length === 0 ? (
        <EmptyState title="아직 등록된 작품이 없어요" />
      ) : (
        <div className="columns-2 gap-6 md:columns-3 lg:columns-4">
          {own.map((w) => <WorkCard key={w.id} work={w} artist={artist} school={school} />)}
        </div>
      )}
    </Container>
  );
}
