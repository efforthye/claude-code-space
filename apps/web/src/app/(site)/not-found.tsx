import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-4 py-24">
      <p className="text-sm font-semibold text-ink-soft">404</p>
      <h1 className="text-2xl font-bold">찾는 페이지가 없어요</h1>
      <p className="text-ink-soft">작품이 비공개로 바뀌었거나 주소가 잘못되었을 수 있습니다.</p>
      <ButtonLink href="/">홈으로</ButtonLink>
    </Container>
  );
}
