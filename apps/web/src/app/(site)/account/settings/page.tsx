import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { DeleteAccountForm, PasswordForm } from "@/features/account/account-forms";
import { ProfileEditor } from "@/features/account/profile-editor";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";

export const metadata: Metadata = { title: "계정 설정", robots: { index: false } };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const me = await requireUser("/account/settings");
  return (
    <AccountShell me={me} mode="buy">
      <Section title="프로필">
        <ProfileEditor me={me} />
      </Section>
      <Section title="비밀번호">
        <div className="glass rounded-xl p-5"><PasswordForm /></div>
      </Section>
      <details className="glass rounded-xl p-5">
        <summary className="font-semibold">회원 탈퇴</summary>
        <div className="mt-4"><DeleteAccountForm /></div>
      </details>
    </AccountShell>
  );
}
