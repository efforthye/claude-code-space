import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { SealIcon } from "@/components/ui/verified-badge";
import { myVerification } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";
import { VerifyForm } from "@/features/account/verify-form";
import { store } from "@/lib/data/store";
import { VERIFY_LABEL } from "@/lib/domain/rules";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "학교 인증", robots: { index: false } };

export default function VerifyPage(props: PageProps<"/account/verify">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Verify searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Verify({ searchParams }: { searchParams: PageProps<"/account/verify">["searchParams"] }) {
  const me = await requireUser("/account/verify");
  const emailResult = (await searchParams).email;
  const last = await myVerification(me.id);
  const school = me.verification ? (await store.read()).schools.find((s) => s.id === me.verification!.schoolId) : undefined;
  return (
    <AccountShell me={me} mode="buy">
      <Section title="학교 인증">
        {emailResult === "confirmed" && <p className="rounded-xl bg-violet/8 p-4 text-sm">학교 이메일을 확인했어요. 운영자가 승인하면 인증 딱지가 붙어요.</p>}
        {emailResult === "invalid" && <p className="rounded-xl bg-dot/10 p-4 text-sm text-dot">확인 링크가 만료됐거나 이미 쓰였어요.</p>}
        <p className="text-sm text-ink-soft">
          인증을 받으면 프로필과 작가 페이지에 학교 인증 딱지가 붙어요. 컬렉터가 작품을 믿고 고를 수 있는 가장 중요한 표시예요.
        </p>
        {me.verification && school ? (
          <div className="glass flex items-center gap-4 rounded-xl p-5">
            <SealIcon className="size-10" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-violet">MAYO 학교 인증</span>
              <span className="font-bold">{school.name} {me.verification.department} {me.verification.status === "student" ? "재학생" : "졸업생"}</span>
              <span className="text-xs text-ink-soft">{VERIFY_LABEL[me.verification.method]}로 확인, {formatDate(me.verification.verifiedAt)}</span>
            </div>
          </div>
        ) : last?.state === "new" ? (
          <div className="glass rounded-xl p-5">
            <p className="font-bold">확인 중이에요</p>
            <p className="mt-1 text-sm text-ink-soft">{last.schoolName} {last.department}, {VERIFY_LABEL[last.method]}로 {formatDate(last.createdAt)}에 신청했어요.</p>
            {last.method === "school_email" && (
              <p className="mt-2 text-sm">{last.emailConfirmedAt ? "학교 이메일 확인 완료. 운영자 승인만 남았어요." : `${last.schoolEmail}로 보낸 확인 메일의 버튼을 눌러 주세요.`}</p>
            )}
          </div>
        ) : (
          <>
            {last?.state === "rejected" && (
              <p className="rounded-xl bg-dot/10 p-4 text-sm text-dot">지난 신청이 확인되지 않았어요{last.reason ? `: ${last.reason}` : ""}. 다시 신청해 주세요.</p>
            )}
            <VerifyForm />
          </>
        )}
      </Section>
    </AccountShell>
  );
}
