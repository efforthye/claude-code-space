"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { TAG } from "@/lib/data/catalog";
import { READONLY_MESSAGE, store, STORE_READONLY } from "@/lib/data/store";
import { allow, TOO_MANY } from "@/lib/security/rate-limit";
import { artShippingIds, PARCEL_FEE, PAYMENT_DUE_HOURS, shippingOptions } from "@/lib/domain/rules";
import type { Order, OrderItem } from "@/lib/domain/types";
import { newId, newOrderCode } from "@/lib/ids";
import { currentUser } from "@/features/account/session";
import { notifyOrderPlaced } from "@/features/mail/notify";

const phone = z.string().trim().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "휴대폰 번호를 확인해 주세요");

const OrderInput = z.object({
  lines: z
    .array(z.object({ workId: z.string().min(1), shipping: z.enum(["parcel", "art_shipping", "pickup"]) }))
    .min(1, "장바구니가 비어 있어요")
    .max(20),
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(40),
  phone,
  email: z.string().trim().email("이메일을 확인해 주세요"),
  address: z.string().trim().max(200),
  deliveryNote: z.string().trim().max(500),
  depositorName: z.string().trim().min(1, "입금자명을 입력해 주세요").max(40),
  agreeTerms: z.literal(true, { error: "이용약관에 동의해 주세요" }),
  agreePrivacy: z.literal(true, { error: "개인정보 수집 및 이용에 동의해 주세요" }),
  agreeAge: z.literal(true, { error: "만 19세 이상이거나 보호자 동의를 받았는지 확인해 주세요" }),
});

export type OrderFormState =
  | { ok: false; errors: Record<string, string>; message?: string }
  | { ok: true; code: string }
  | null;

export async function placeOrder(_prev: OrderFormState, form: FormData): Promise<OrderFormState> {
  if (STORE_READONLY) return { ok: false, errors: {}, message: READONLY_MESSAGE };
  if (!(await allow("order", 10, 10 * 60_000))) return { ok: false, errors: {}, message: TOO_MANY };
  const parsed = OrderInput.safeParse({
    lines: JSON.parse(String(form.get("lines") ?? "[]")),
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email"),
    address: form.get("address") ?? "",
    deliveryNote: form.get("deliveryNote") ?? "",
    depositorName: form.get("depositorName"),
    agreeTerms: form.get("agreeTerms") === "on",
    agreePrivacy: form.get("agreePrivacy") === "on",
    agreeAge: form.get("agreeAge") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const input = parsed.data;
  if (input.lines.some((l) => l.shipping !== "pickup") && input.address.length < 5) {
    return { ok: false, errors: { address: "배송받을 주소를 입력해 주세요" } };
  }

  const me = await currentUser(); // 로그인 중이면 마이페이지에 바로 보이도록
  const result = await store.update((db): OrderFormState => {
    const items: OrderItem[] = [];
    const unavailable: string[] = [];
    for (const line of input.lines) {
      const work = db.works.find((w) => w.id === line.workId);
      if (!work || work.status !== "available") {
        unavailable.push(work?.title ?? "삭제된 작품");
        continue;
      }
      if (!shippingOptions(work, artShippingIds(db.categories)).includes(line.shipping)) {
        return { ok: false, errors: {}, message: `「${work.title}」은(는) 선택한 방법으로 받을 수 없어요. 장바구니에서 받는 방법을 다시 골라 주세요.` };
      }
      const artist = db.artists.find((a) => a.id === work.artistId);
      items.push({ workId: work.id, title: work.title, artistName: artist?.name ?? "", edition: work.edition, price: work.price, shipping: line.shipping, seller: work.consignor, certificateRequestedAt: null });
    }
    if (unavailable.length > 0) {
      return { ok: false, errors: {}, message: `이미 예약되었거나 판매된 작품이 있어요: ${unavailable.map((t) => `「${t}」`).join(", ")}. 장바구니에서 빼고 다시 신청해 주세요.` };
    }

    const now = new Date();
    const order: Order = {
      id: newId("ord"),
      code: newOrderCode(),
      items,
      buyer: { name: input.name, phone: input.phone, email: input.email, address: input.address, deliveryNote: input.deliveryNote },
      depositorName: input.depositorName,
      subtotal: items.reduce((s, i) => s + i.price, 0),
      parcelFee: items.some((i) => i.shipping === "parcel") ? PARCEL_FEE : 0,
      shippingQuote: null,
      status: "pending_payment",
      paymentMethod: "bank_transfer",
      paymentDueAt: new Date(now.getTime() + PAYMENT_DUE_HOURS * 3600_000).toISOString(),
      paidAt: null,
      adminMemo: "",
      history: [{ at: now.toISOString(), status: "pending_payment", note: "주문 신청" }],
      createdAt: now.toISOString(),
    };
    // 같은 작품이 두 번 팔리지 않도록 신청 즉시 예약으로 묶는다.
    for (const item of items) {
      const work = db.works.find((w) => w.id === item.workId)!;
      work.status = "reserved";
      work.updatedAt = now.toISOString();
    }
    db.orders.push({ ...order, userId: me?.id ?? null });
    return { ok: true, code: order.code };
  });

  if (result?.ok) {
    updateTag(TAG.catalog);
    notifyOrderPlaced(result.code);
  }
  return result;
}
