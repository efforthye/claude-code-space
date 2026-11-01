import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { WorkImage } from "@/features/catalog/work-image";
import { logout } from "@/features/account/actions";
import { ClaimCodeForm, DeleteAccountForm, DeviceClaim, PasswordForm, ProfileForm } from "@/features/account/account-forms";
import { myAccountData } from "@/features/account/queries";
import { requireUser } from "@/features/account/session";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const me = await requireUser("/account");
  const { orders, requests } = await myAccountData(me.id);

  return (
    <Container className="flex max-w-4xl flex-col gap-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-display text-xl text-violet italic">My page</span>
          <h1 className="text-3xl font-bold">{me.name}님</h1>
          <p className="text-sm text-ink-soft">{me.email}</p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="sm">로그아웃</Button>
        </form>
      </header>

      <DeviceClaim />

      <Section title="내 주문" count={orders.length}>
        {orders.length === 0 ? (
          <Empty>
            아직 주문이 없어요. <Link href="/works" className="link-sweep font-semibold text-violet">작품 보러 가기</Link>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.code} className="glass flex flex-col gap-3 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/orders/${o.code}`} className="link-sweep font-mono text-sm font-semibold">{o.code}</Link>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-ink-soft">{formatDate(o.createdAt)}</span>
                    <Badge tone={o.status === "pending_payment" ? "warn" : o.status === "cancelled" ? "neutral" : "ok"}>{o.statusLabel}</Badge>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {o.items.map((i) => (
                    <li key={i.workId} className="flex items-center gap-3">
                      <WorkImage src={i.cover ?? undefined} alt="" className="size-14 shrink-0 rounded-md" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/works/${i.workId}`} className="truncate font-semibold hover:underline">「{i.title}」</Link>
                        <span className="text-xs text-ink-soft">{i.artistName}</span>
                      </div>
                      {i.certificate && (
                        <Link href={`/certificates/${i.certificate}`} className="glass shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-violet transition-colors hover:bg-white">
                          보증서
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t border-ink/10 pt-2 text-sm">
                  <span className="text-ink-soft">결제 금액</span>
                  <span className="font-semibold">{formatPrice(o.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="내 신청과 문의" count={requests.length}>
        {requests.length === 0 ? (
          <Empty>
            작가 입점, 전시 등록, 문의를 하면 여기서 진행 상황을 볼 수 있어요.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.code} className="glass flex flex-col gap-1.5 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.href ? <Link href={r.href} className="hover:underline">{r.title}</Link> : r.title}</span>
                  <Badge tone={r.tone}>{r.state}</Badge>
                </div>
                <span className="font-mono text-xs text-ink-soft">{r.code}, {formatDate(r.createdAt)}</span>
                {r.detail && <p className="rounded-md bg-white/70 p-3 text-sm whitespace-pre-line">{r.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="번호로 연결하기">
        <p className="mb-3 text-sm text-ink-soft">로그인하기 전이나 다른 기기에서 넣은 주문, 신청도 받은 번호로 이 계정에 모을 수 있어요.</p>
        <ClaimCodeForm />
      </Section>

      <Section title="계정 정보">
        <ProfileForm name={me.name} phone={me.phone} />
      </Section>
      <Section title="비밀번호">
        <PasswordForm />
      </Section>
      <details className="glass rounded-lg p-5">
        <summary className="font-semibold">회원 탈퇴</summary>
        <div className="mt-4"><DeleteAccountForm /></div>
      </details>
    </Container>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        {title}
        {count != null && count > 0 && <span className="bg-aurora rounded-full px-2 py-0.5 text-xs text-white">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="glass rounded-lg p-6 text-center text-sm text-ink-soft">{children}</p>;
}
