import type { Metadata } from "next";
import { Container, PageHeading } from "@/components/ui/container";
import { MyList } from "@/features/my/my-list";

export const metadata: Metadata = { title: "내 신청 현황", robots: { index: false } };

export default function MyPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <PageHeading
        title="내 신청 현황"
        description="이 기기에서 넣은 주문·작가 입점 신청·전시 등록 신청·문의의 진행 상황이에요. 다른 기기에서 넣었다면 받은 번호로 추가하세요."
      />
      <MyList />
    </Container>
  );
}
