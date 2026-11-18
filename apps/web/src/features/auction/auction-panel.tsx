"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/action-form";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { buyNow, placeBid, type BidState } from "./actions";
import type { AuctionSnapshot } from "./server";

/** 남은 시간: "1일 06:12:40", 하루 안이면 "06:12:40" */
export function remaining(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400);
  const hms = [Math.floor((t % 86400) / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}일 ${hms}` : hms;
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

/** 1초마다 바뀌는 지금 시각 */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function AuctionPanel({ initial, loginHref }: { initial: AuctionSnapshot; loginHref: string }) {
  const [snap, setSnap] = useState(initial);
  const [sheet, setSheet] = useState<null | "max" | "once">(null);
  const [toast, setToast] = useState<string | null>(null);
  const now = useNow();
  const wasOutbid = useRef(initial.me?.outbid ?? false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/auctions/${initial.id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const next = (await res.json()) as AuctionSnapshot;
    if (next.me?.outbid && !wasOutbid.current) setToast(`더 높은 입찰이 들어왔어요. 현재 ${formatPrice(next.price)}`);
    wasOutbid.current = next.me?.outbid ?? false;
    setSnap(next);
  }, [initial.id]);

  // 화면을 보고 있을 때만 갱신. 마감 2분 전부터는 더 자주 (마감이 지나도 결과가 올 때까지 계속)
  const left = Date.parse(snap.endsAt) - now;
  const fast = snap.phase === "live" && left < 120_000;
  useEffect(() => {
    if (snap.phase === "ended") return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, fast ? 2000 : 5000);
    return () => clearInterval(t);
  }, [reload, fast, snap.phase]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const me = snap.me;
  const live = snap.phase === "live" && left > 0;

  return (
    <section aria-label="경매" className="flex flex-col gap-4">
      {toast && (
        <p role="status" className="glass fixed top-20 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg">
          {toast}
        </p>
      )}

      <Clock snap={snap} now={now} />

      {snap.phase !== "ended" ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-ink-soft">{snap.bidCount > 0 ? "현재 최고 입찰가" : "시작가"}</p>
            <p className="text-3xl font-bold tabular-nums">{formatPrice(snap.price)}</p>
          </div>
          {me?.leading && <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok">내가 최고 입찰 중</span>}
          {me?.outbid && <span className="rounded-full bg-dot/10 px-3 py-1 text-xs font-bold text-dot">최대 금액 초과됨</span>}
        </div>
      ) : (
        <Result snap={snap} />
      )}

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <Tile label="시작가" value={formatPrice(snap.startPrice)} />
        <Tile label="입찰" value={`${snap.bidCount}회`} />
        <Tile label="입찰 단위" value={formatPrice(snap.increment)} />
      </dl>

      {snap.bids.length > 0 && (
        <ol aria-label="입찰 내역" className="flex max-h-56 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white/70 px-3 text-sm">
          {snap.bids.map((b, i) => (
            <li key={`${b.at}-${i}`} className="flex items-center justify-between gap-2 py-2">
              <span className={cn("flex items-center gap-1.5", b.mine && "font-bold")}>
                {b.mine ? "나" : b.alias}
                {b.auto && <span className="text-[11px] font-semibold text-violet">자동입찰</span>}
              </span>
              <span className="tabular-nums">
                {formatPrice(b.amount)} <span className="text-xs text-ink-soft">{ago(b.at, now)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {snap.offer && (
        <p className="rounded-xl bg-violet/10 p-3 text-sm">
          다시 구매할 기회가 왔어요: {formatPrice(snap.offer.amount)}. <Link href="/account/bids" className="font-semibold underline underline-offset-4">내 경매에서 답하기</Link>
        </p>
      )}

      {live && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white/80 p-4">
          <div className="flex justify-between text-xs text-ink-soft">
            <span>{me?.max ? "내 최대 금액" : "현재가"}</span>
            {snap.canBuyNow && snap.buyNowPrice != null && <span>즉시구매</span>}
          </div>
          <div className="-mt-2 flex justify-between font-bold tabular-nums">
            <span>{formatPrice(me?.max ?? snap.price)}</span>
            {snap.canBuyNow && snap.buyNowPrice != null && <span>{formatPrice(snap.buyNowPrice)}</span>}
          </div>
          {!me || me.block ? (
            <Blocked block={me?.block ?? "login"} loginHref={loginHref} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setSheet("max")}>{me.max ? "최대 금액 올리기" : "최대 금액 설정"}</Button>
              <Button onClick={() => setSheet("once")} disabled={me.leading}>{formatPrice(snap.minimum)} 입찰</Button>
            </div>
          )}
          {me && !me.block && snap.canBuyNow && snap.buyNowPrice != null && <BuyNow snap={snap} onDone={reload} />}
        </div>
      )}

      {snap.phase === "upcoming" && <p className="text-sm text-ink-soft">경매가 시작되면 입찰할 수 있어요. 전시장 QR이나 이 화면에서 참여할 수 있어요.</p>}

      <p className="text-xs leading-relaxed text-ink-soft">
        낙찰되면 낙찰가에 구매 수수료 {Math.round(snap.feeRate * 100)}%가 더해져요. 마지막 1분 안에 입찰이 들어오면 마감이 90초 늘어나요.{" "}
        <Link href="/legal/auction" className="underline underline-offset-4">경매 이용 약관</Link>
      </p>

      {sheet && me && (
        <BidSheet
          snap={snap}
          mode={sheet}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function Clock({ snap, now }: { snap: AuctionSnapshot; now: number }) {
  if (snap.phase === "ended") return <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm font-semibold">경매가 끝났어요</p>;
  const upcoming = snap.phase === "upcoming";
  const target = Date.parse(upcoming ? snap.startsAt : snap.endsAt);
  return (
    <div className={cn("flex items-center justify-between rounded-xl px-4 py-3 text-white", snap.extended ? "bg-dot" : "bg-ink")}>
      <span className="text-xs leading-tight">
        {upcoming ? "시작까지" : snap.extended ? (<>마감 연장됨<br />마지막 1분 입찰</>) : "마감까지"}
      </span>
      <span className="text-2xl font-bold tabular-nums" aria-live="off">{remaining(target - now)}</span>
    </div>
  );
}

function Result({ snap }: { snap: AuctionSnapshot }) {
  const r = snap.result;
  if (!r) return <p className="text-sm text-ink-soft">결과를 정리하고 있어요…</p>;
  if (r.kind === "no_sale") return <p className="text-sm">입찰 없이 끝났어요. 작품은 정가로 계속 판매해요.</p>;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-ink-soft">낙찰가</p>
      <p className="text-3xl font-bold tabular-nums">{formatPrice(r.hammer)}</p>
      <p className="text-xs text-ink-soft">{r.payment === "paid" ? "대금 완납" : r.payment === "failed" ? "미납으로 낙찰 취소" : "결제 기다리는 중"}</p>
      {r.mine && (
        <Link href="/account/bids" className="mt-2 font-semibold text-violet underline underline-offset-4">
          낙찰 축하드려요. 받는 곳을 확인하고 입금해 주세요
        </Link>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink/5 px-2 py-2.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-bold tabular-nums">{value}</dd>
    </div>
  );
}

const BLOCK_TEXT = {
  login: "로그인하고 입찰할 수 있어요.",
  minor: "경매는 만 19세 이상만 참여할 수 있어요.",
  phone: "낙찰 연락을 위해 휴대폰 번호를 먼저 등록해 주세요.",
  strikes: "결제하지 않은 낙찰이 두 번 있어 입찰할 수 없어요.",
  own_work: "본인 작품에는 입찰할 수 없어요.",
  staff: "MAYO 운영자는 입찰할 수 없어요.",
} as const;

function Blocked({ block, loginHref }: { block: keyof typeof BLOCK_TEXT; loginHref: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{BLOCK_TEXT[block]}</p>
      {block === "login" && <Link href={loginHref} className="font-semibold text-violet underline underline-offset-4">로그인하고 입찰하기</Link>}
      {block === "phone" && <Link href="/account/settings" className="font-semibold text-violet underline underline-offset-4">휴대폰 번호 등록</Link>}
    </div>
  );
}

function Breakdown({ amount, snap, label }: { amount: number; snap: AuctionSnapshot; label: string }) {
  const fee = Math.round(amount * snap.feeRate);
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums">{formatPrice(amount)}</dd>
      <dt className="text-ink-soft">구매 수수료 ({Math.round(snap.feeRate * 100)}%)</dt>
      <dd className="tabular-nums">{formatPrice(fee)}</dd>
      <dt className="text-ink-soft">배송비</dt>
      <dd className="text-right text-ink-soft">직접 수령 0원, 택배와 전문 운송은 따로</dd>
      <dt className="border-t border-line pt-2 font-bold">최대 결제 금액</dt>
      <dd className="border-t border-line pt-2 font-bold tabular-nums">{formatPrice(amount + fee)}</dd>
    </dl>
  );
}

function BidSheet({ snap, mode, onClose, onDone }: { snap: AuctionSnapshot; mode: "max" | "once"; onClose: () => void; onDone: () => void }) {
  const [state, action, pending] = useActionState<BidState, FormData>(placeBid.bind(null, snap.id), null);
  const floor = snap.me?.leading && snap.me.max ? snap.me.max + snap.increment : snap.minimum;
  const [amount, setAmount] = useState(mode === "once" ? snap.minimum : Math.max(floor, snap.minimum));
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={mode === "max" ? "자동입찰 최대 금액 설정" : "입찰 확인"} className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-8 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 sm:hidden" />
        <ActionForm action={action} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{mode === "max" ? "자동입찰 최대 금액 설정" : "입찰 확인"}</h2>
          {mode === "max" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">최대 금액</span>
                <Input name="amount" inputMode="numeric" value={amount.toLocaleString("ko-KR")} onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} className="h-12 text-lg font-bold" />
                <span className="text-xs text-ink-soft">{formatPrice(floor)} 이상</span>
              </label>
              <p className="rounded-xl bg-violet/8 p-3 text-xs leading-relaxed">
                다른 사람이 입찰하면 <b>최대 {formatPrice(amount)}까지</b> {formatPrice(snap.increment)}씩 자동으로 올려 드려요. 전시장에서 화면을 계속 보고 있지 않아도 돼요. 최대 금액은 나만 볼 수 있어요.
              </p>
            </>
          ) : (
            <input type="hidden" name="amount" value={amount} />
          )}
          <Breakdown amount={amount} snap={snap} label={mode === "max" ? "최대 낙찰가" : "입찰가"} />
          {!snap.me?.agreed && (
            <Checkbox name="agreeAuction" label={<>낙찰되면 구매 계약이 성립하고 48시간 안에 결제해야 한다는 <Link href="/legal/auction" className="underline" target="_blank">경매 이용 약관</Link>에 동의해요</>} />
          )}
          {state && !state.ok && <p role="alert" className="text-sm font-medium text-dot">{state.message}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
            <Button type="submit" disabled={pending}>{mode === "max" ? `최대 ${formatPrice(amount)}으로 설정` : `${formatPrice(amount)} 입찰하기`}</Button>
          </div>
        </ActionForm>
      </div>
    </div>,
    document.body,
  );
}

function BuyNow({ snap, onDone }: { snap: AuctionSnapshot; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BidState, FormData>(buyNow.bind(null, snap.id), null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-ink-soft underline underline-offset-4">
        {formatPrice(snap.buyNowPrice!)}에 즉시구매
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col gap-3 rounded-xl bg-ink/5 p-3">
      <Breakdown amount={snap.buyNowPrice!} snap={snap} label="즉시구매가" />
      {!snap.me?.agreed && <Checkbox name="agreeAuction" label={<>경매 이용 약관에 동의해요</>} />}
      {state && <p role={state.ok ? "status" : "alert"} className={cn("text-sm font-medium", state.ok ? "text-ok" : "text-dot")}>{state.message}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>닫기</Button>
        <Button type="submit" size="sm" disabled={pending}>즉시구매하고 경매 끝내기</Button>
      </div>
    </ActionForm>
  );
}
