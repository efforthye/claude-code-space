import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { WorkImage } from "@/features/catalog/work-image";
import { DeviceClaim } from "@/features/account/account-forms";
import { myAccountData } from "@/features/account/queries";
import { requireUser } from "@/features/account/session";
import { AccountShell, Empty, Section } from "@/features/account/shell";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  const me = await requireUser("/account");
  const { orders } = await myAccountData(me.id);
  return (
    <AccountShell me={me} mode="buy">
      <DeviceClaim />
      <Section title="주문과 보증서" count={orders.length}>
        {orders.length === 0 ? (
          <Empty>
            아직 주문이 없어요. <Link href="/works" className="link-sweep font-semibold text-violet">작품 보러 가기</Link>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.code} className="glass flex flex-col gap-3 rounded-xl p-4">
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
                      <WorkImage src={i.cover ?? undefined} alt="" className="size-14 shrink-0 rounded-lg" />
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
    </AccountShell>
  );
}
