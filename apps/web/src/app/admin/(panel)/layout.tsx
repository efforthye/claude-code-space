import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/features/admin/admin-nav";
import { logout } from "@/features/admin/auth-actions";
import { requireAdmin } from "@/features/admin/session";

export const metadata: Metadata = { title: { default: "관리자", template: "%s | MAYO 관리자" }, robots: { index: false } };

async function Gate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-wall md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-line bg-paper p-3 md:w-52 md:border-r md:border-b-0 md:p-4 print:hidden">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-lg font-black">MAYO <span className="text-xs font-semibold text-ink-soft">관리자</span></Link>
          <form action={logout}><button className="text-xs text-ink-soft underline">로그아웃</button></form>
        </div>
        <Suspense fallback={<div className="h-64" />}>
          <AdminNav />
        </Suspense>
        <Link href="/" className="hidden text-xs text-ink-soft underline md:block">사이트 보기 ↗</Link>
      </aside>
      <main className="flex-1 overflow-x-auto p-4 md:p-8">
        <Suspense fallback={<p className="text-ink-soft">불러오는 중…</p>}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}
