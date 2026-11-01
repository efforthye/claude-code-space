import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeading } from "@/components/ui/container";
import { ContactForm } from "@/features/inquiries/contact-form";

export const metadata: Metadata = { title: "문의하기" };

const FAQ = [
  { q: "작품은 어떻게 결제하나요?", a: "주문 신청 후 안내되는 계좌로 입금하면, 확인되는 대로 작가와 배송 일정을 조율해요." },
  { q: "학교를 다니지 않아도 입점할 수 있나요?", a: "네. 일반 작가와 미대 지망생도 신청할 수 있어요. 학교 인증 딱지만 붙지 않아요." },
  { q: "반품할 수 있나요?", a: "받은 날부터 7일 안에 청약철회할 수 있어요. 주문제작 작품은 결제 전 따로 안내해요." },
];

export default function ContactPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-10 py-10">
      <PageHeading title="문의하기" description={<>진행 중인 신청은 <Link href="/account" className="underline">마이페이지</Link>나 <Link href="/my" className="underline">비회원 주문 조회</Link>에서 먼저 확인해 보세요.</>} />
      <section className="flex flex-col divide-y divide-line rounded-md border border-line bg-paper">
        {FAQ.map((f) => (
          <details key={f.q} className="group p-4">
            <summary className="flex items-center justify-between font-semibold">
              {f.q}
              <span aria-hidden className="transition-[translate,rotate,scale,transform] group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm text-ink-soft">{f.a}</p>
          </details>
        ))}
      </section>
      <ContactForm />
    </Container>
  );
}
