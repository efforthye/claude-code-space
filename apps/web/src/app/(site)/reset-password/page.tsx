import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { ResetPasswordForm } from "@/features/account/auth-forms";

export const metadata: Metadata = { title: "새 비밀번호", robots: { index: false } };

export default function Page() {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-14">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-bold">새 비밀번호</h1>
        <p className="text-sm text-ink-soft">새 비밀번호를 정하면 모든 기기에서 로그아웃돼요.</p>
      </div>
      <div className="glass rounded-xl p-6 sm:p-8">
        <Suspense fallback={<div className="h-40" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </Container>
  );
}
