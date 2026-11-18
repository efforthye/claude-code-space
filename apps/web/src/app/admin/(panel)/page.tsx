import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { adminDb } from "@/features/admin/session";
import { getSiteSettings } from "@/lib/data/catalog";
import { isPaymentOverdue, ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import type { OrderStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { getBusinessInfo } from "@/lib/site";

type Db = Awaited<ReturnType<typeof adminDb>>;

/**
 * 통합 대시보드 (기획 17번). 작가 페이지, 작가 판매 홈, 주문과 정산 데이터를 한 화면에 모은다.
 * 위에서부터: 이번 달 숫자, 작가별 현황(작가 페이지 + 판매 홈 데이터), 오늘 처리할 일, 운영 지표, 최근 주문.
 */
export default async function AdminDashboard() {
  const db = await adminDb();
  const { logoMark } = await getSiteSettings();
  const pending = db.orders.filter((o) => o.status === "pending_payment");
  const overdue = pending.filter(isPaymentOverdue);
  const toShip = db.orders.filter((o) => o.status === "paid" || o.status === "preparing");
  const quoteNeeded = db.orders.filter(
    (o) => o.status !== "cancelled" && o.items.some((i) => i.shipping === "art_shipping") && o.shippingQuote == null,
  );
  // 월 경계는 한국 시간 기준
  const today = formatDate(new Date().toISOString());
  const month = today.slice(0, 7);
  const monthSales = db.orders
    .filter((o) => o.paidAt && formatDate(o.paidAt).slice(0, 7) === month && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.subtotal, 0);
  const recent = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const certRequests = db.orders.flatMap((o) => o.items.filter((i) => i.certificateRequestedAt && !db.certificates.some((c) => c.orderId === o.id && c.workId === i.workId && !c.revokedAt))).length;
  const artists = artistOverview(db);
  const dueTotal = artists.reduce((n, a) => n + a.due, 0);
  const goals = operationGoals(db);

  const hero = [
    { label: "이번 달 거래액 (입금 확인)", value: formatPrice(monthSales), href: "/admin/ledger" },
    { label: "판매 중 작품", value: `${db.works.filter((w) => w.status === "available").length}점`, href: "/admin/works" },
    { label: "입점 작가", value: `${db.artists.length}명`, sub: `학교 인증 ${db.artists.filter((a) => a.verifiedBy).length}명`, href: "/admin/artists" },
    { label: "작가 정산 예정", value: formatPrice(dueTotal), href: "/admin/ledger" },
  ];
  const todos = [
    { label: "입금 대기", n: pending.length, href: "/admin/orders?status=pending_payment" },
    { label: "입금 기한 지남", n: overdue.length, href: "/admin/orders?status=pending_payment", urgent: true },
    { label: "배송 준비", n: toShip.length, href: "/admin/orders?status=paid" },
    { label: "운송 견적 필요", n: quoteNeeded.length, href: "/admin/orders" },
    { label: "새 입점 신청", n: db.applications.filter((a) => a.state === "new").length, href: "/admin/applications" },
    { label: "작품 검수 대기", n: db.works.filter((w) => w.pendingReview).length, href: "/admin/works" },
    { label: "학교 인증 대기", n: db.verifications.filter((v) => v.state === "new").length, href: "/admin/verifications" },
    { label: "답변 대기 문의", n: db.inquiries.filter((q) => q.state === "new").length, href: "/admin/inquiries" },
    { label: "보증서 요청", n: certRequests, href: "/admin/orders" },
    { label: "새 전시 등록 신청", n: db.exhibitionRequests.filter((r) => r.state === "new").length, href: "/admin/exhibition-requests" },
  ].sort((a, b) => Number(b.n > 0) - Number(a.n > 0));
  const openTodos = todos.filter((t) => t.n > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo mark={logoMark} className="text-[40px]" />
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold">통합 대시보드</h1>
            <p className="text-sm text-ink-soft">{today} 기준, 작가, 작품, 주문, 정산을 한 화면에서 봐요.</p>
          </div>
        </div>
        {getBusinessInfo().artServiceNumber === "등록 예정" && (
          <Link href="/admin/compliance" className="glass rounded-full px-4 py-2 text-xs font-semibold text-violet">
            사업자 할 일: 미술서비스업 신고 (2027.7.25까지) →
          </Link>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {hero.map((h, i) => (
          <Link
            key={h.label}
            href={h.href}
            className={cn(
              "flex flex-col gap-1 rounded-2xl p-5 transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg",
              i === 0 ? "bg-aurora text-white shadow-md" : "glass",
            )}
          >
            <span className={cn("text-xs font-semibold", i === 0 ? "text-white/85" : "text-ink-soft")}>{h.label}</span>
            <span className="text-3xl font-bold tracking-tight">{h.value}</span>
            {h.sub && <span className="text-xs text-ink-soft">{h.sub}</span>}
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">작가별 현황</h2>
            <span className="text-xs text-ink-soft">작가 페이지와 작가 판매 홈 데이터를 함께 봐요</span>
          </div>
          <ul className="flex flex-col gap-2">
            {artists.slice(0, 5).map((a) => (
              <li key={a.id} className="glass flex items-center gap-4 rounded-2xl px-4 py-3">
                <Avatar src={a.avatar} name={a.name} className="size-11 text-[44px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 font-bold">
                    {a.name}
                    <Badge tone={a.group === "졸업생" ? "clay" : "neutral"}>{a.group}</Badge>
                    {a.verified && <Badge tone="ok">학교 인증</Badge>}
                  </span>
                  <span className="text-xs text-ink-soft">{a.school}</span>
                  <span className="flex gap-3 text-xs font-semibold">
                    <Link href={`/artists/${a.id}`} className="text-violet">작가 페이지 ↗</Link>
                    <Link href={`/admin/artists/${a.id}`} className="text-ink-soft">관리 →</Link>
                  </span>
                </div>
                <Metric label="판매 중" value={`${a.available}점`} />
                <Metric label="판매 완료" value={`${a.sold}점`} />
                <Metric label="판매 금액" value={formatPrice(a.revenue)} />
                <Metric label="정산 예정" value={formatPrice(a.due)} />
                <Metric label="판매 홈 접속" value={a.lastSeen} muted={!a.linked} />
              </li>
            ))}
          </ul>
          <h2 className="mt-3 font-bold">최근 주문</h2>
          <div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-soft">아직 주문이 없어요.</p>
        ) : (
          <ul className="glass divide-y divide-line rounded-2xl text-sm">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-white/60">
                  <span><b>{o.code}</b>, {o.buyer.name}, {o.items.map((i) => `「${i.title}」`).join(", ")}</span>
                  <span className="flex items-center gap-2 text-ink-soft">
                    <Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    {formatDateTime(o.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              오늘 처리할 일
              {openTodos > 0 && <span className="bg-aurora rounded-full px-2 py-0.5 text-[11px] text-white">{openTodos}</span>}
            </h2>
            <div className="glass grid grid-cols-2 gap-1.5 rounded-2xl p-3">
              {todos.map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-200",
                    t.n > 0 ? (t.urgent ? "bg-clay-soft font-semibold text-clay" : "bg-mist font-semibold text-ink") : "text-ink-faint hover:bg-white/70",
                  )}
                >
                  <span className="truncate">{t.label}</span>
                  <b>{t.n}</b>
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-bold">운영 지표</h2>
            <div className="flex flex-col gap-2">
              {goals.map((g) => (
                <div key={g.label} className="glass flex flex-col gap-1.5 rounded-2xl p-4">
                  <span className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-soft">
                    {g.label}
                    <span className={cn("rounded-full px-2 py-0.5", g.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{g.goal}</span>
                  </span>
                  <span className="text-xl font-bold">{g.value}</span>
                  <div className="h-1.5 rounded-full bg-mist">
                    <div className="bg-aurora h-1.5 rounded-full" style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className="text-[11px] text-ink-soft">{g.sub}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

    </div>
  );
}

const STATUS_TONE: Record<OrderStatus, "warn" | "ok" | "neutral" | "violet"> = {
  pending_payment: "warn",
  paid: "ok",
  preparing: "ok",
  shipped: "violet",
  completed: "neutral",
  cancelled: "neutral",
};

function Metric({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex w-[72px] shrink-0 flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
      <span className={cn("text-sm font-bold", muted && "font-semibold text-ink-faint")}>{value}</span>
    </div>
  );
}

/** 작가별 현황: 작가 페이지(프로필, 학교, 구분) + 판매 홈(작품, 판매, 정산, 접속) 데이터를 한 줄로 */
function artistOverview(db: Db) {
  const now = Date.now();
  const DAY = 86_400_000;
  return db.artists
    .map((a) => {
      const works = db.works.filter((w) => w.artistId === a.id);
      const ids = new Set(works.map((w) => w.id));
      const items = db.orders
        .filter((o) => o.paidAt && o.status !== "cancelled")
        .flatMap((o) => o.items.filter((i) => ids.has(i.workId)));
      const revenue = items.reduce((n, i) => n + i.price, 0);
      const due = items.filter((i) => !i.settledAt).reduce((n, i) => n + i.price, 0);
      const seen = a.userId ? db.sessions.filter((x) => x.userId === a.userId).map((x) => Date.parse(x.lastSeenAt)) : [];
      const last = seen.length ? Math.max(...seen) : null;
      const days = last == null ? null : Math.floor((now - last) / DAY);
      const school = db.schools.find((s) => s.id === a.schoolId);
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        group: db.artistGroups.find((g) => g.id === a.status)?.label ?? a.status,
        verified: Boolean(a.verifiedBy),
        school: [school?.name, a.department, a.gradYear ? `${a.gradYear} 졸업${a.gradYear > new Date().getFullYear() ? " 예정" : ""}` : null].filter(Boolean).join(", "),
        available: works.filter((w) => w.status === "available").length,
        sold: works.filter((w) => w.status === "sold").length,
        revenue,
        due,
        linked: Boolean(a.userId),
        lastSeen: !a.userId ? "계정 연결 전" : days == null ? "접속 기록 없음" : days === 0 ? "오늘" : `${days}일 전`,
      };
    })
    .sort((x, y) => y.revenue - x.revenue || y.available - x.available);
}

/** 운영 지표 (기획 17번 성과 지표를 대시보드에서 바로 확인) */
function operationGoals(db: Db) {
  const HOUR = 3_600_000;
  const now = Date.now();
  // 1) 입점 심사 처리 시간: 승인된 신청의 접수 시각부터 작가 생성(승인) 시각까지 평균
  const reviewHours = db.applications
    .map((a) => ({ a, artist: a.artistId ? db.artists.find((x) => x.id === a.artistId) : undefined }))
    .filter((r) => r.artist)
    .map((r) => (Date.parse(r.artist!.createdAt) - Date.parse(r.a.createdAt)) / HOUR)
    .filter((h) => h >= 0);
  const avgReview = reviewHours.length ? Math.round(reviewHours.reduce((n, h) => n + h, 0) / reviewHours.length) : null;
  const waiting = db.applications.filter((a) => a.state === "new").map((a) => (now - Date.parse(a.createdAt)) / HOUR);
  const oldestWaiting = waiting.length ? Math.round(Math.max(...waiting)) : null;
  // 2) 작가 판매 홈 월간 활성률: 회원이 연결된 작가 중 최근 30일 안에 로그인 기록이 있는 비율
  const linked = db.artists.filter((a) => a.userId);
  const active = linked.filter((a) => db.sessions.some((x) => x.userId === a.userId && now - Date.parse(x.lastSeenAt) < 30 * 24 * HOUR));
  const activeRate = linked.length ? Math.round((active.length / linked.length) * 100) : null;
  // 3) 졸업 1년 후 페이지 유지율: 졸업 1년이 지난 작가 중 최근 1년 안에 작품을 올리거나 고친 비율
  const thisYear = new Date().getFullYear();
  const graduated = db.artists.filter((a) => a.gradYear != null && a.gradYear <= thisYear - 1);
  const kept = graduated.filter((a) => db.works.some((w) => w.artistId === a.id && now - Date.parse(w.updatedAt) < 365 * 24 * HOUR));
  const keepRate = graduated.length ? Math.round((kept.length / graduated.length) * 100) : null;
  return [
    { label: "입점 심사 처리 시간", value: avgReview == null ? "기록 없음" : `평균 ${avgReview}시간`, goal: "목표 48시간 내", progress: avgReview == null ? 0 : Math.min(100, Math.round((48 / Math.max(avgReview, 1)) * 100)), sub: oldestWaiting == null ? "대기 중인 신청 없음" : `가장 오래 기다린 신청 ${oldestWaiting}시간`, ok: avgReview != null && avgReview <= 48 },
    { label: "작가 판매 홈 월간 활성률", value: activeRate == null ? "연결된 작가 없음" : `${activeRate}%`, goal: "목표 50% 이상", progress: activeRate ?? 0, sub: `회원 연결 작가 ${linked.length}명 중 ${active.length}명이 30일 안에 접속`, ok: activeRate != null && activeRate >= 50 },
    { label: "졸업 1년 후 페이지 유지율", value: keepRate == null ? "해당 작가 없음" : `${keepRate}%`, goal: "목표 80% 이상", progress: keepRate ?? 0, sub: `졸업 1년 지난 작가 ${graduated.length}명 중 ${kept.length}명이 1년 안에 작품 갱신`, ok: keepRate != null && keepRate >= 80 },
  ];
}
