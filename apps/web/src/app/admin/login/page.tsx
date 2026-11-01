import type { Metadata } from "next";
import { LoginForm } from "@/features/admin/login-form";

export const metadata: Metadata = { title: "관리자 로그인", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-md border border-line bg-paper p-6">
        <p className="text-xl font-black">MAYO <span className="text-sm font-semibold text-ink-soft">관리자</span></p>
        <LoginForm />
      </div>
    </main>
  );
}
