import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Container } from "@/components/ui/container";
import { SealIcon } from "@/components/ui/verified-badge";
import { store } from "@/lib/data/store";
import { cn } from "@/lib/cn";
import { logout } from "./actions";
import { AccountNav, type NavItem } from "./account-nav";
import type { Me } from "./session";

/**
 * 마이페이지 틀: 배경 이미지와 프로필(트위터처럼), 구매와 판매 전환 탭, 왼쪽 메뉴.
 * 작가로 연결된 회원은 판매 탭에서 작품과 판매 주문, 정산을 본다.
 */
export async function AccountShell({ me, mode, children }: { me: Me; mode: "buy" | "sell"; children: ReactNode }) {
  const db = await store.read();
  const artist = db.artists.find((a) => a.userId === me.id) ?? null;
  const school = me.verification ? db.schools.find((s) => s.id === me.verification!.schoolId) : undefined;
  const pendingWorks = artist ? db.works.filter((w) => w.artistId === artist.id && w.pendingReview).length : 0;

  const buy: NavItem[] = [
    { href: "/account", label: "주문과 보증서" },
    { href: "/account/requests", label: "신청과 문의" },
    { href: "/account/verify", label: "학교 인증" },
    { href: "/account/settings", label: "계정 설정" },
  ];
  const sell: NavItem[] = [
    { href: "/account/sell", label: "판매 홈" },
    ...(artist
      ? [
          { href: "/account/sell/works", label: "내 작품", badge: pendingWorks || undefined },
          { href: "/account/sell/orders", label: "판매 주문" },
          { href: "/account/sell/profile", label: "작가 프로필" },
        ]
      : []),
    { href: "/account/verify", label: "학교 인증" },
    { href: "/account/settings", label: "계정 설정" },
  ];

  return (
    <Container className="flex flex-col gap-6 py-8">
      <section className="glass overflow-hidden rounded-2xl">
        <div className={cn("relative h-36 sm:h-48", !me.cover && "bg-aurora")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {me.cover && <img src={me.cover} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5 sm:px-7">
          <div className="flex min-w-0 flex-col gap-2">
            <Avatar src={me.avatar} name={me.name} className="-mt-12 size-24 border-4 border-white text-[52px] shadow-lg" />
            <div className="flex flex-col gap-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
                {me.name}
                {me.verification && school && (
                  <span className="flex items-center gap-1 rounded-full bg-violet/10 px-2.5 py-0.5 text-xs font-semibold text-violet">
                    <SealIcon className="size-4" /> {school.shortName} 인증
                  </span>
                )}
              </h1>
              <p className="text-sm text-ink-soft">{me.email}</p>
              {me.bio && <p className="max-w-xl text-sm leading-relaxed">{me.bio}</p>}
              {artist && (
                <Link href={`/artists/${artist.id}`} className="link-sweep w-fit text-sm font-semibold text-violet">
                  내 작가 페이지 →
                </Link>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/account/settings" className="glass flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors hover:bg-white">프로필 편집</Link>
            <form action={logout}>
              <button type="submit" className="flex h-10 items-center rounded-full px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/80 hover:text-ink">로그아웃</button>
            </form>
          </div>
        </div>
      </section>

      <div className="flex w-full max-w-xs gap-1 self-start rounded-full bg-white/70 p-1" role="tablist" aria-label="구매, 판매 전환">
        {(["buy", "sell"] as const).map((m) => (
          <Link
            key={m}
            href={m === "buy" ? "/account" : "/account/sell"}
            role="tab"
            aria-selected={mode === m}
            className={cn("flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors", mode === m ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
          >
            {m === "buy" ? "구매" : "판매"}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <aside className="md:sticky md:top-24 md:w-52 md:shrink-0">
          <AccountNav items={mode === "buy" ? buy : sell} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </Container>
  );
}

/** 마이페이지 섹션 제목 + 내용 */
export function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {title}
          {count != null && count > 0 && <span className="bg-aurora rounded-full px-2 py-0.5 text-xs text-white">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="glass rounded-xl p-8 text-center text-sm text-ink-soft">{children}</div>;
}
