import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { GoogleNotice, SignupForm } from "@/features/account/auth-forms";
import { currentUser } from "@/features/account/session";
import { GOOGLE_ENABLED } from "@/features/account/google";
import { GoogleButton, OrDivider } from "@/features/account/google-button";

export const metadata: Metadata = { title: "회원가입", robots: { index: false } };

export default function Page() {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-14">
      <div className="flex flex-col gap-1 text-center">
        <span className="font-display text-xl text-violet italic">Join MAYO</span>
        <h1 className="text-3xl font-bold">회원가입</h1>
        <p className="text-sm text-ink-soft">가입하지 않아도 주문할 수 있어요. 가입하면 주문과 신청, 보증서가 마이페이지에 모여요.</p>
      </div>
      <div className="glass rounded-xl p-6 sm:p-8">
        <Suspense fallback={<div className="h-72" />}>
          <AlreadyIn />
          {GOOGLE_ENABLED && (
            <div className="mb-5 flex flex-col gap-5">
              <GoogleNotice />
              <GoogleButton />
              <OrDivider />
            </div>
          )}
          <SignupForm />
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
