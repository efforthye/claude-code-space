"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { TAG } from "@/lib/data/catalog";
import { READONLY_MESSAGE, store, STORE_READONLY } from "@/lib/data/store";
import { auctionPhase, canBuyNow, placeMax } from "@/lib/domain/auction";
import { artShippingIds, PARCEL_FEE, shippingOptions } from "@/lib/domain/rules";
import { newId } from "@/lib/ids";
import { allow, TOO_MANY } from "@/lib/security/rate-limit";
import { currentUser } from "@/features/account/session";
import { notifyAuction } from "@/features/mail/notify";
import { BID_BLOCK_MESSAGE, bidBlock, createAuctionOrder, settleDueAuctions } from "./server";

export type BidState = { ok: boolean; message: string } | null;

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 입찰 = 최대 금액 정하기. 한 번 입찰 버튼도 "다음 최소 금액"을 최대 금액으로 보낸다 */
export async function placeBid(auctionId: string, _prev: BidState, form: FormData): Promise<BidState> {
  if (STORE_READONLY) return { ok: false, message: READONLY_MESSAGE };
  if (!(await allow("bid", 30, 60_000))) return { ok: false, message: TOO_MANY };
  const me = await currentUser();
  if (!me) return { ok: false, message: BID_BLOCK_MESSAGE.login };
  const amount = Number(String(form.get("amount") ?? "").replace(/[^\d]/g, ""));
  const agree = form.get("agreeAuction") === "on";
  await settleDueAuctions();

  const result = await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    const work = a && db.works.find((w) => w.id === a.workId);
    const user = db.users.find((u) => u.id === me.id);
    if (!a || !work || !user) return { ok: false as const, message: "경매를 찾을 수 없어요." };
    const block = bidBlock(db, user, work);
    if (block) return { ok: false as const, message: BID_BLOCK_MESSAGE[block] };
    if (!user.auctionAgreedAt) {
      if (!agree) return { ok: false as const, message: "경매 이용 약관에 동의해 주세요." };
      user.auctionAgreedAt = new Date().toISOString();
    }
    const r = placeMax(a, user.id, amount, Date.now(), () => newId("bid"));
    if (!r.ok) {
      const message = {
        not_live: "지금은 입찰할 수 없는 경매예요.",
        too_low: `${won(r.minimum)} 이상으로 입찰해 주세요.`,
        too_high: "금액을 다시 확인해 주세요.",
        not_raised: "이미 최고 입찰 중이에요. 최대 금액을 올리려면 지금보다 큰 금액을 넣어 주세요.",
        over_buy_now: `즉시구매가(${won(a.buyNowPrice ?? 0)}) 이상이면 즉시구매를 이용해 주세요.`,
      }[r.error];
      return { ok: false as const, message };
    }
    return { ok: true as const, r, workId: work.id };
  });

  if (!result.ok) return { ok: false, message: result.message };
  const { r, workId } = result;
  if (r.outbid) notifyAuction(r.outbid, workId, "outbid", r.price);
  const tail = r.extended ? " 마감 직전 입찰이라 마감이 90초 늘었어요." : "";
  if (r.leading) return { ok: true, message: `최고 입찰 중이에요. 현재가 ${won(r.price)}, 최대 ${won(amount)}까지 자동으로 올려 드려요.${tail}` };
  return { ok: true, message: `다른 분의 최대 금액이 더 높아 현재가가 ${won(r.price)}이 됐어요. 더 올려 보세요.${tail}` };
}

/** 즉시구매: 즉시구매가로 사면 경매가 바로 끝난다 */
export async function buyNow(auctionId: string, _prev: BidState, form: FormData): Promise<BidState> {
  if (STORE_READONLY) return { ok: false, message: READONLY_MESSAGE };
  if (!(await allow("bid", 30, 60_000))) return { ok: false, message: TOO_MANY };
  const me = await currentUser();
  if (!me) return { ok: false, message: BID_BLOCK_MESSAGE.login };
  const agree = form.get("agreeAuction") === "on";
  await settleDueAuctions();

  const result = await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    const work = a && db.works.find((w) => w.id === a.workId);
    const user = db.users.find((u) => u.id === me.id);
    if (!a || !work || !user) return { ok: false as const, message: "경매를 찾을 수 없어요." };
    const block = bidBlock(db, user, work);
    if (block) return { ok: false as const, message: BID_BLOCK_MESSAGE[block] };
    if (auctionPhase(a, Date.now()) !== "live" || !canBuyNow(a) || a.buyNowPrice == null) return { ok: false as const, message: "지금은 즉시구매할 수 없어요." };
    if (!user.auctionAgreedAt) {
      if (!agree) return { ok: false as const, message: "경매 이용 약관에 동의해 주세요." };
      user.auctionAgreedAt = new Date().toISOString();
    }
    const now = new Date();
    const order = createAuctionOrder(db, a, user.id, a.buyNowPrice, "경매 즉시구매", now);
    if (!order) return { ok: false as const, message: "주문을 만들지 못했어요." };
    a.state = "closed";
    a.endsAt = now.toISOString();
    a.updatedAt = now.toISOString();
    a.result = { kind: "sold", via: "buy_now", userId: user.id, hammer: a.buyNowPrice, at: now.toISOString(), orderId: order.id, payment: "pending" };
    return { ok: true as const, amount: a.buyNowPrice, workId: work.id, others: a.maxes.map((m) => m.userId).filter((id) => id !== user.id) };
  });
  if (!result.ok) return { ok: false, message: result.message };
  notifyAuction(me.id, result.workId, "buy_now", result.amount);
  for (const id of result.others) notifyAuction(id, result.workId, "outbid", result.amount);
  updateTag(TAG.catalog);
  refresh();
  return { ok: true, message: "즉시구매로 경매가 끝났어요. 내 경매에서 받는 곳을 확인하고 입금해 주세요." };
}

/** 차순위 구매 제안 수락: 제안 금액으로 주문을 만든다 */
export async function acceptOffer(auctionId: string) {
  const me = await currentUser();
  if (!me || STORE_READONLY) return;
  const done = await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    if (!a?.offer || a.offer.userId !== me.id || Date.parse(a.offer.expiresAt) <= Date.now()) return null;
    const now = new Date();
    const order = createAuctionOrder(db, a, me.id, a.offer.amount, "경매 차순위 구매", now);
    if (!order) return null;
    a.result = { kind: "sold", via: "second_chance", userId: me.id, hammer: a.offer.amount, at: now.toISOString(), orderId: order.id, payment: "pending" };
    a.offer = null;
    a.updatedAt = now.toISOString();
    return { workId: a.workId, amount: order.subtotal };
  });
  if (done) notifyAuction(me.id, done.workId, "won", done.amount);
  updateTag(TAG.catalog);
  refresh();
}

/** 차순위 구매 제안 거절: 다음 사람에게 넘기지 않고 작품은 정가 판매로 돌아간다 */
export async function declineOffer(auctionId: string) {
  const me = await currentUser();
  if (!me || STORE_READONLY) return;
  await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    if (!a?.offer || a.offer.userId !== me.id) return;
    a.failedUserIds.push(me.id);
    a.offer = null;
    const work = db.works.find((w) => w.id === a.workId);
    if (work && work.status === "reserved") {
      work.status = "available";
      work.auctionId = null;
    }
  });
  updateTag(TAG.catalog);
  refresh();
}

const PayInput = z.object({
  shipping: z.enum(["parcel", "art_shipping", "pickup"]),
  address: z.string().trim().max(200),
  deliveryNote: z.string().trim().max(500),
  depositorName: z.string().trim().min(1, "입금자명을 입력해 주세요").max(40),
});

/** 낙찰 주문의 받는 방법, 주소, 입금자명을 낙찰자가 채운다 */
export async function completeAuctionOrder(orderId: string, _prev: BidState, form: FormData): Promise<BidState> {
  const me = await currentUser();
  if (!me) return { ok: false, message: BID_BLOCK_MESSAGE.login };
  const parsed = PayInput.safeParse(Object.fromEntries(["shipping", "address", "deliveryNote", "depositorName"].map((k) => [k, String(form.get(k) ?? "")])));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.shipping !== "pickup" && v.address.length < 5) return { ok: false, message: "배송받을 주소를 입력해 주세요." };
  const message = await store.update((db) => {
    const o = db.orders.find((x) => x.id === orderId);
    if (!o || o.userId !== me.id || !o.auctionId || o.status !== "pending_payment") return "바꿀 수 없는 주문이에요.";
    const work = db.works.find((w) => w.id === o.items[0]?.workId);
    if (!work || !shippingOptions(work, artShippingIds(db.categories)).includes(v.shipping)) return "이 작품은 그 방법으로 받을 수 없어요.";
    o.items[0].shipping = v.shipping;
    o.parcelFee = v.shipping === "parcel" ? PARCEL_FEE : 0;
    o.buyer.address = v.address;
    o.buyer.deliveryNote = v.deliveryNote;
    o.depositorName = v.depositorName;
    return null;
  });
  if (message) return { ok: false, message };
  refresh();
  return { ok: true, message: "저장했어요. 안내된 계좌로 입금해 주세요." };
}

/** 작가가 자기 작품을 경매로 내고 싶다고 신청한다. 일정은 운영자가 전시에 맞춰 정한다 */
export async function requestAuction(workId: string, _prev: BidState, form: FormData): Promise<BidState> {
  const me = await currentUser();
  if (!me) return { ok: false, message: BID_BLOCK_MESSAGE.login };
  if (STORE_READONLY) return { ok: false, message: READONLY_MESSAGE };
  const n = (k: string) => Number(String(form.get(k) ?? "").replace(/[^\d]/g, "")) || 0;
  const startPrice = n("startPrice");
  const increment = n("increment");
  const buyNowPrice = n("buyNowPrice") || null;
  if (startPrice < 10_000) return { ok: false, message: "시작가는 1만 원 이상으로 정해 주세요." };
  if (![5_000, 10_000, 20_000, 50_000].includes(increment)) return { ok: false, message: "입찰 단위를 골라 주세요." };
  if (buyNowPrice !== null && buyNowPrice <= startPrice) return { ok: false, message: "즉시구매가는 시작가보다 커야 해요." };
  const message = await store.update((db) => {
    const artist = db.artists.find((a) => a.userId === me.id);
    const work = artist && db.works.find((w) => w.id === workId && w.artistId === artist.id);
    if (!work) return "작품을 찾을 수 없어요.";
    if (work.status !== "available" || work.auctionId) return "판매 중인 작품만 경매로 낼 수 있어요.";
    if (db.auctions.some((a) => a.workId === workId && a.state === "requested")) return "이미 신청한 작품이에요.";
    const now = new Date().toISOString();
    db.auctions.push({
      id: newId("auc"),
      workId,
      exhibitionId: work.exhibitionId,
      startPrice,
      increment,
      buyNowPrice,
      startsAt: now,
      endsAt: now,
      originalEndsAt: now,
      state: "requested",
      requestedBy: "artist",
      bids: [],
      maxes: [],
      result: null,
      failedUserIds: [],
      offer: null,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  });
  if (message) return { ok: false, message };
  refresh();
  return { ok: true, message: "경매 신청을 받았어요. 전시 일정에 맞춰 운영자가 열어 드려요." };
}
