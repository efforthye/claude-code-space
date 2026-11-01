import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container, PageHeading } from "@/components/ui/container";
import { Field, Input } from "@/components/ui/field";

export const metadata: Metadata = { title: "주문 조회" };

async function lookup(form: FormData) {
  "use server";
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (code) redirect(`/orders/${encodeURIComponent(code.startsWith("MAYO-") ? code : `MAYO-${code}`)}`);
}

export default function OrderLookupPage() {
  return (
    <Container className="flex max-w-md flex-col gap-8 py-12">
      <PageHeading title="주문 조회" description="주문 신청 후 받은 주문번호로 입금·배송 상태를 확인할 수 있어요." />
      <form action={lookup} className="flex flex-col gap-4">
        <Field label="주문번호"><Input name="code" placeholder="MAYO-XXXXXXXX" required /></Field>
        <Button type="submit">조회하기</Button>
      </form>
    </Container>
  );
}
