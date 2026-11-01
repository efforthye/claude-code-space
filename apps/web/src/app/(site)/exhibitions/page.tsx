import type { Metadata } from "next";
import { FreeBadge } from "@/components/ui/free-badge";
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
      <aside className="glass relative isolate flex flex-col gap-4 overflow-hidden rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <span aria-hidden className="bg-aurora absolute -top-16 -right-10 -z-10 size-48 rounded-full opacity-25 blur-3xl" />
        <span aria-hidden className="absolute -bottom-20 left-1/3 -z-10 size-40 rounded-full bg-violet/20 blur-3xl" />
        <div className="flex flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
            우리 학과 졸업전시와 과제전도 MAYO에 올려 보세요
            <FreeBadge />
          </p>
          <p className="text-sm text-ink-soft">목록에 없거나 정보가 다르면 신청해 주세요. 온라인 전시 페이지, 작품 촬영, QR 캡션 라벨까지 지원해요.</p>
        </div>
        <ButtonLink href="/exhibitions/apply" className="shrink-0">전시 등록 신청하기</ButtonLink>
      </aside>
      <ExhibitionList rows={rows} schools={schools.map((s) => ({ id: s.id, name: s.name }))} />
    </Container>
  );
}
