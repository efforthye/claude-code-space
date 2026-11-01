import type { Metadata } from "next";
import { Container, PageHeading } from "@/components/ui/container";
import { MyList } from "@/features/my/my-list";

export const metadata: Metadata = { title: "비회원 주문 조회", robots: { index: false } };

export default function MyPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <PageHeading
        title="비회원 주문 조회"
        description={<>이 기기에서 넣은 주문, 신청, 문의의 진행 상황이에요. 다른 기기에서 넣었다면 받은 번호로 추가하세요. <a href="/signup" className="font-semibold text-violet underline-offset-2 hover:underline">회원가입</a>하면 마이페이지에 모아 볼 수 있어요.</>}
      />
      <MyList />
    </Container>
  );
}
