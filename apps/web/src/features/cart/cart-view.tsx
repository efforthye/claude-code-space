"use client";

import { ActionForm } from "@/components/ui/action-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/container";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { placeOrder, type OrderFormState } from "@/features/orders/actions";
import { WorkImage } from "@/features/catalog/work-image";
import { PARCEL_FEE, SHIPPING_LABEL, shippingOptions } from "@/lib/domain/rules";
import type { Artist, ShippingMethod, Work } from "@/lib/domain/types";
import { formatPrice, formatSize } from "@/lib/format";
import { cart, useCart } from "./cart-store";

export function CartView({ works, artists }: { works: Work[]; artists: Artist[] }) {
  const lines = useCart();
  const router = useRouter();
  const [state, action, pending] = useActionState<OrderFormState, FormData>(placeOrder, null);
  const workById = new Map(works.map((w) => [w.id, w]));
  const artistById = new Map(artists.map((a) => [a.id, a]));

  useEffect(() => {
    if (state?.ok) {
      cart.clear();
      router.push(`/orders/${state.code}?new=1`);
    }
  }, [state, router]);

  const rows = lines.map((l) => ({ line: l, work: workById.get(l.workId) }));
  const orderable = rows.filter((r): r is { line: typeof r.line; work: Work } => r.work?.status === "available");
  const subtotal = orderable.reduce((s, r) => s + r.work.price, 0);
  const parcel = orderable.some((r) => r.line.shipping === "parcel") ? PARCEL_FEE : 0;
  const hasArtShipping = orderable.some((r) => r.line.shipping === "art_shipping");
  const needsAddress = orderable.some((r) => r.line.shipping !== "pickup");
  const errors = state && !state.ok ? state.errors : {};

  if (lines.length === 0 && !state?.ok)
    return (
      <EmptyState title="장바구니가 비어 있어요">
        <Link href="/#collection" className="font-semibold text-ink underline underline-offset-4">작품 둘러보기</Link>
      </EmptyState>
    );

  return (
    <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {rows.map(({ line, work }) => {
          if (!work)
            return (
              <li key={line.workId} className="flex items-center justify-between py-4 text-sm text-ink-soft">
                더 이상 판매하지 않는 작품입니다.
                <Button variant="ghost" size="sm" onClick={() => cart.remove(line.workId)}>빼기</Button>
              </li>
            );
          const unavailable = work.status !== "available";
          return (
            <li key={line.workId} className="flex gap-4 py-4">
              <Link href={`/works/${work.id}`} className="size-24 shrink-0 bg-paper p-1.5">
                <WorkImage src={work.images[0]} alt={work.title} className="size-full" />
              </Link>
              <div className="flex flex-1 flex-col gap-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">「{work.title}」 · {artistById.get(work.artistId)?.name}</span>
                  <span className="font-bold">{formatPrice(work.price)}</span>
                </div>
                <span className="text-ink-soft">{work.materials} · {formatSize(work.widthCm, work.heightCm, work.depthCm)}</span>
                {unavailable ? (
                  <span className="font-semibold text-dot">● 다른 컬렉터가 먼저 예약했어요 — 주문에서 제외됩니다</span>
                ) : (
                  <label className="mt-1 flex items-center gap-2">
                    <span className="text-ink-soft">받는 방법</span>
                    <select
                      value={line.shipping}
                      onChange={(e) => cart.setShipping(work.id, e.target.value as ShippingMethod)}
                      className="h-8 rounded-sm border border-line bg-paper px-2"
                    >
                      {shippingOptions(work).map((o) => <option key={o} value={o}>{SHIPPING_LABEL[o]}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" onClick={() => cart.remove(work.id)} className="mt-1 w-fit text-xs text-ink-soft underline underline-offset-2">
                  장바구니에서 빼기
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ActionForm action={action} className="flex flex-col gap-5 rounded-md border border-line bg-paper p-5">
        <input type="hidden" name="lines" value={JSON.stringify(orderable.map((r) => r.line))} />
        <h2 className="text-lg font-bold">주문 신청</h2>
        <dl className="flex flex-col gap-1 border-b border-line pb-4 text-sm">
          <div className="flex justify-between"><dt>작품 {orderable.length}점</dt><dd>{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between"><dt>일반 택배비</dt><dd>{formatPrice(parcel)}</dd></div>
          {hasArtShipping && <div className="flex justify-between text-warn"><dt>미술품 전문 운송</dt><dd>견적 후 별도 안내</dd></div>}
          <div className="mt-2 flex justify-between text-base font-bold"><dt>입금하실 금액</dt><dd>{formatPrice(subtotal + parcel)}</dd></div>
        </dl>

        <Field label="받는 분 이름" required error={errors.name}><Input name="name" autoComplete="name" /></Field>
        <Field label="휴대폰" required error={errors.phone}><Input name="phone" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" /></Field>
        <Field label="이메일" required error={errors.email} hint="주문 안내를 보내드려요"><Input name="email" type="email" autoComplete="email" /></Field>
        {needsAddress && (
          <Field label="배송 주소" required error={errors.address}><Input name="address" autoComplete="street-address" /></Field>
        )}
        {hasArtShipping && (
          <Field label="운송 참고 사항" hint="층수, 엘리베이터 유무, 희망 시기, 진입로 등 — 운송 견적에 필요해요">
            <Textarea name="deliveryNote" />
          </Field>
        )}
        <Field label="입금자명" required error={errors.depositorName} hint="입금 확인에 쓰여요. 받는 분과 다르면 꼭 적어 주세요">
          <Input name="depositorName" />
        </Field>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Checkbox name="agreeTerms" label={<><Link href="/legal/terms" target="_blank" className="underline">이용약관</Link>과 청약철회 안내를 확인했어요 (필수)</>} />
          <Checkbox name="agreePrivacy" label={<>주문 처리를 위한 <Link href="/legal/privacy" target="_blank" className="underline">개인정보 수집·이용</Link>에 동의해요 (필수)</>} />
          <Checkbox name="agreeAge" label="만 19세 이상이거나, 법정대리인(보호자)의 동의를 받았어요 (필수)" />
          {(errors.agreeTerms || errors.agreePrivacy || errors.agreeAge) && (
            <p className="text-xs font-medium text-dot">{errors.agreeTerms ?? errors.agreePrivacy ?? errors.agreeAge}</p>
          )}
        </div>

        {state && !state.ok && state.message && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot">{state.message}</p>}

        <Button type="submit" size="lg" disabled={pending || orderable.length === 0}>
          {pending ? "신청하는 중…" : "주문 신청하기"}
        </Button>
        <p className="text-xs leading-relaxed text-ink-soft">
          신청하면 작품이 바로 예약되고, 다음 화면에서 입금 계좌를 안내드려요. 48시간 안에 입금이 확인되지 않으면 예약이 풀릴
          수 있어요.
        </p>
      </ActionForm>
    </div>
  );
}
