import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container, PageHeading } from "@/components/ui/container";
import { ExhibitionList, type ExhibitionRow } from "@/features/exhibitions/exhibition-list";
import { exhibitionPhase, getCatalog, indexById } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "전시" };

export default async function ExhibitionsPage() {
  const { exhibitions, works, schools, today } = await getCatalog();
  const schoolById = indexById(schools);
  const order = { ongoing: 0, upcoming: 1, ended: 2 } as const;
  const rows: ExhibitionRow[] = exhibitions
    .map((e) => ({
      id: e.id,
      title: e.title,
      schoolId: e.schoolId,
      schoolShort: e.schoolId ? schoolById.get(e.schoolId)?.shortName ?? null : null,
      venue: e.venue,
      startDate: e.startDate,
      endDate: e.endDate,
      phase: exhibitionPhase(e, today),
      works: works.filter((w) => w.exhibitionId === e.id).length,
    }))
    .sort((a, b) => order[a.phase] - order[b.phase] || (a.phase === "ended" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)));

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading
        eyebrow="Exhibitions"
        title="졸업전시와 과제전"
        description="2026년 가을 미대, 디자인 졸업전시 일정을 모았어요. 학과 포스터와 공개 일정표를 정리한 정보라 바뀔 수 있으니, 방문 전 학과 공식 계정에서 확인하세요."
      />
      <aside className="flex flex-col gap-3 rounded-md border-2 border-ink bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">우리 학과 졸업전시와 과제전도 MAYO에 올려 보세요</p>
          <p className="text-sm text-ink-soft">목록에 없거나 정보가 다르면 신청해 주세요. 온라인 전시 페이지, 작품 촬영, QR 캡션 라벨까지 — 이번 시즌 무료예요.</p>
        </div>
        <ButtonLink href="/exhibitions/apply" className="shrink-0">전시 등록 신청하기</ButtonLink>
      </aside>
      <ExhibitionList rows={rows} schools={schools.map((s) => ({ id: s.id, name: s.name }))} />
    </Container>
  );
}
