import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { pendingGoogleSignup } from "@/features/account/google-pending";
import { GoogleSignupForm } from "@/features/account/auth-forms";

export const metadata: Metadata = { title: "구글로 가입", robots: { index: false } };

export default function GoogleSignupPage() {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-14">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-bold">거의 다 됐어요</h1>
        <p className="text-sm text-ink-soft">출생연도와 약관 동의만 확인하면 가입이 끝나요.</p>
      </div>
      <div className="glass rounded-xl p-6 sm:p-8">
        <Suspense fallback={<div className="h-56" />}>
          <Pending />
        </Suspense>
      </div>
    </Container>
  );
}

async function Pending() {
  const p = await pendingGoogleSignup();
  if (!p) redirect("/login?google=expired");
  return <GoogleSignupForm email={p.email} name={p.name} />;
}
