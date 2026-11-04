import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { ClaimCodeForm } from "@/features/account/account-forms";
import { myAccountData } from "@/features/account/queries";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "신청과 문의", robots: { index: false } };

export default function RequestsPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Requests />
    </Suspense>
  );
}

async function Requests() {
  const me = await requireUser("/account/requests");
  const { requests } = await myAccountData(me.id);
  return (
    <AccountShell me={me} mode="buy">
      <Section title="신청과 문의" count={requests.length}>
        {requests.length === 0 ? (
          <Empty>작가 입점, 전시 등록, 문의를 하면 여기서 진행 상황을 볼 수 있어요.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.code} className="glass flex flex-col gap-1.5 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.href ? <Link href={r.href} className="hover:underline">{r.title}</Link> : r.title}</span>
                  <Badge tone={r.tone}>{r.state}</Badge>
                </div>
                <span className="font-mono text-xs text-ink-soft">{r.code}, {formatDate(r.createdAt)}</span>
                {r.detail && <p className="rounded-lg bg-white/70 p-3 text-sm whitespace-pre-line">{r.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="번호로 연결하기">
        <p className="text-sm text-ink-soft">로그인하기 전이나 다른 기기에서 넣은 주문, 신청도 받은 번호로 이 계정에 모을 수 있어요.</p>
        <ClaimCodeForm />
      </Section>
    </AccountShell>
  );
}
