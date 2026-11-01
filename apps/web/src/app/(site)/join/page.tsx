import type { Metadata } from "next";
import { Container, PageHeading } from "@/components/ui/container";
import { JoinForm } from "@/features/applications/join-form";

export const metadata: Metadata = { title: "작가 입점 신청" };

const PERKS = [
  { t: "이번 시즌 판매 수수료 0%", d: "졸업전시 시즌에 입점하면 수수료 없이 판매해요." },
  { t: "작품 촬영 무료", d: "전시장으로 찾아가 대표 사진을 찍어 드려요." },
  { t: "QR 캡션 라벨", d: "작품 캡션 옆 QR로 관람객이 바로 구매 신청할 수 있어요." },
  { t: "판매는 원하는 작품만", d: "기록만 남기고 싶다면 비공개로 둘 수도 있어요." },
];

export default function JoinPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-10 py-10">
      <PageHeading
        eyebrow="For artists"
        title="졸업작품, 전시 끝나고 창고 말고 새 주인에게"
        description="회화부터 가구·의상·조각·금속공예까지. 재학생·졸업생·미대 지망생·일반 작가 누구나 신청할 수 있어요."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {PERKS.map((p) => (
          <li key={p.t} className="rounded-md border border-line bg-paper p-4">
            <p className="font-bold">{p.t}</p>
            <p className="text-sm text-ink-soft">{p.d}</p>
          </li>
        ))}
      </ul>
      <JoinForm />
    </Container>
  );
}
