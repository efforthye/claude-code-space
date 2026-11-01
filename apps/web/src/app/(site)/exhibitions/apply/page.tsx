import type { Metadata } from "next";
import { Container, PageHeading } from "@/components/ui/container";
import { ExhibitionRequestForm } from "@/features/exhibitions/request-form";

export const metadata: Metadata = { title: "졸업전시와 과제전 등록 신청" };

const STEPS = [
  { n: "1", t: "신청", d: "전시 정보와 담당자 연락처를 남겨 주세요." },
  { n: "2", t: "전시 페이지 오픈", d: "MAYO가 온라인 전시 페이지를 만들어 드려요." },
  { n: "3", t: "촬영과 QR 라벨", d: "전시장에서 작품을 촬영하고, 캡션 옆에 붙일 QR 라벨을 드려요." },
  { n: "4", t: "전시 후에도", d: "전시가 끝나도 작품은 페이지에 남고, 원하는 작가는 판매할 수 있어요." },
];

export default function ExhibitionApplyPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-10 py-10">
      <PageHeading
        eyebrow="For organizers"
        title="졸업전시와 과제전 등록 신청"
        description="졸업준비위원회, 학생회, 학과, 또는 참여 작가 누구나 신청할 수 있어요. 이번 시즌 등록, 촬영, QR 라벨은 무료입니다."
      />
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3 rounded-md border border-line bg-paper p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">{s.n}</span>
            <span><b>{s.t}</b><br /><span className="text-sm text-ink-soft">{s.d}</span></span>
          </li>
        ))}
      </ol>
      <ExhibitionRequestForm />
    </Container>
  );
}
