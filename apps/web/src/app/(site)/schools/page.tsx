import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeading } from "@/components/ui/container";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "학교" };

export default async function SchoolsPage() {
  const { schools, artists, works, exhibitions } = await getCatalog();
  const rows = schools.map((s) => {
    const ofSchool = artists.filter((a) => a.schoolId === s.id);
    const ids = new Set(ofSchool.map((a) => a.id));
    return {
      s,
      artists: ofSchool.length,
      verified: ofSchool.filter((a) => a.verifiedBy).length,
      exhibitions: exhibitions.filter((e) => e.schoolId === s.id),
      works: works.filter((w) => ids.has(w.artistId)).length,
    };
  });

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading eyebrow="Schools" title="학교별 보기" description="MAYO는 각 학교의 공식 서비스가 아니며, 학생 작가가 직접 입점한 작품을 소개합니다." />
      {rows.length === 0 ? (
        <EmptyState title="등록된 학교가 없어요" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.s.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-5">
              <h2 className="text-lg font-bold">{r.s.name}</h2>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div><dt className="text-xs text-ink-soft">작가</dt><dd className="text-xl font-bold">{r.artists}</dd></div>
                <div><dt className="text-xs text-ink-soft">인증 작가</dt><dd className="text-xl font-bold">{r.verified}</dd></div>
                <div><dt className="text-xs text-ink-soft">작품</dt><dd className="text-xl font-bold">{r.works}</dd></div>
              </dl>
              {r.exhibitions.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
                  {r.exhibitions.map((e) => (
                    <li key={e.id}><Link href={`/exhibitions/${e.id}`} className="underline-offset-4 hover:underline">{e.title}</Link></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
