import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { LoginForm } from "@/features/account/auth-forms";
import { currentUser } from "@/features/account/session";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

export default function Page() {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-14">
      <div className="flex flex-col gap-1 text-center">
        <span className="font-display text-xl text-violet italic">Welcome back</span>
        <h1 className="text-3xl font-bold">로그인</h1>
        <p className="text-sm text-ink-soft">주문, 신청, 작품 보증서를 마이페이지에서 한 번에 확인하세요.</p>
      </div>
      <div className="glass rounded-xl p-6 sm:p-8">
        <Suspense fallback={<div className="h-72" />}>
          <AlreadyIn />
          <LoginForm />
        </Suspense>
      </div>
    </Container>
  );
}

/** 이미 로그인했으면 마이페이지로 */
async function AlreadyIn() {
  if (await currentUser()) redirect("/account");
  return null;
}
