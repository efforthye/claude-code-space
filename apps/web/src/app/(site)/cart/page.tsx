import type { Metadata } from "next";
import { Container, PageHeading } from "@/components/ui/container";
import { CartView } from "@/features/cart/cart-view";
import { getCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "장바구니" };

export default async function CartPage() {
  const { works, artists, categories } = await getCatalog();
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeading title="장바구니" description="이 기기에만 저장돼요. 로그인 없이 주문 신청할 수 있습니다." />
      <CartView works={works} artists={artists} artShipping={categories.filter((c) => c.artShipping).map((c) => c.id)} />
    </Container>
  );
}
