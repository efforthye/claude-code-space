import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { ForgotPasswordForm } from "@/features/account/auth-forms";

export const metadata: Metadata = { title: "비밀번호 찾기", robots: { index: false } };

export default function Page() {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-14">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-bold">비밀번호 찾기</h1>
        <p className="text-sm text-ink-soft">가입한 이메일로 비밀번호를 다시 정하는 링크를 보내 드려요.</p>
      </div>
      <div className="glass rounded-xl p-6 sm:p-8">
        <Suspense fallback={<div className="h-40" />}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </Container>
  );
}
