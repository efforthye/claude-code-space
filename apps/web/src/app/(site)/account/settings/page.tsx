import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { DeleteAccountForm, PasswordForm } from "@/features/account/account-forms";
import { ProfileEditor } from "@/features/account/profile-editor";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";
import { GOOGLE_ENABLED } from "@/features/account/google";
import { GoogleButton } from "@/features/account/google-button";
import { store } from "@/lib/data/store";

export const metadata: Metadata = { title: "계정 설정", robots: { index: false } };

export default function SettingsPage(props: PageProps<"/account/settings">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Settings searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/account/settings">["searchParams"] }) {
  const me = await requireUser("/account/settings");
  const googleResult = (await searchParams).google;
  const user = (await store.read()).users.find((u) => u.id === me.id);
  const linked = !!user?.googleSub;
  const hasPassword = !!user?.passwordHash;
  return (
    <AccountShell me={me} mode="buy">
      <Section title="프로필">
        <ProfileEditor me={me} />
      </Section>
      <Section title="구글 계정">
        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-5 text-sm">
          {linked ? (
            <span>구글 계정이 연결돼 있어요. 구글로 로그인할 수 있어요.</span>
          ) : GOOGLE_ENABLED ? (
            <>
              <span>구글 계정을 연결하면 비밀번호 없이 로그인할 수 있어요.</span>
              <div className="w-56"><GoogleButton href="/auth/google?link=1" label="구글 계정 연결" /></div>
            </>
          ) : (
            <span className="text-ink-soft">구글 로그인을 준비하고 있어요.</span>
          )}
          {googleResult === "linked" && <p className="w-full text-violet">연결했어요.</p>}
          {googleResult === "taken" && <p className="w-full text-dot">그 구글 계정은 이미 다른 회원과 연결돼 있어요.</p>}
        </div>
      </Section>
      <Section title="비밀번호">
        {!hasPassword && <p className="text-sm text-ink-soft">구글로 가입해서 아직 비밀번호가 없어요. 정해 두면 이메일로도 로그인할 수 있어요. 지금 비밀번호 칸은 비워 두세요.</p>}
        <div className="glass rounded-xl p-5"><PasswordForm /></div>
      </Section>
      <details className="glass rounded-xl p-5">
        <summary className="font-semibold">회원 탈퇴</summary>
        <div className="mt-4"><DeleteAccountForm /></div>
      </details>
    </AccountShell>
  );
}
