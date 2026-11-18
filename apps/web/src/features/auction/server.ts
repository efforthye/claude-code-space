import "server-only";
import { auctionPhase, bidderAliases, buyerFee, canBuyNow, hammer, minimumBid, OFFER_HOURS, standing, STRIKE_LIMIT, type AuctionPhase } from "@/lib/domain/auction";
import { artShippingIds, isMinor, PARCEL_FEE, PAYMENT_DUE_HOURS, shippingOptions } from "@/lib/domain/rules";
import type { Auction, Database, ID, Order, User, Work } from "@/lib/domain/types";
import { store } from "@/lib/data/store";
import { newId, newOrderCode } from "@/lib/ids";

export const DEFAULT_BUYER_FEE_RATE = 0.1;

export function feeRate(db: Pick<Database, "settings">) {
  return db.settings.auctionBuyerFeeRate ?? DEFAULT_BUYER_FEE_RATE;
}

/** 운영자(직원) 계정: 미술진흥법 제15조⑤3 "자신이 실시하는 경매에 참여" 금지. 이메일로 지정 */
function staffEmails() {
  return new Set(
    (process.env.MAYO_STAFF_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type BidBlock = "login" | "minor" | "phone" | "strikes" | "own_work" | "staff" | null;

/** 이 회원이 이 작품 경매에 입찰할 수 있는가. 이유를 돌려준다 (화면 안내와 서버 검사에 같이 쓴다) */
export function bidBlock(db: Database, user: Pick<User, "id" | "email" | "birthYear" | "phone" | "auctionStrikes"> | null, work: Work): BidBlock {
  if (!user) return "login";
  // 미성년자 계약은 법정대리인이 취소할 수 있어(민법 제5조) 낙찰이 흔들린다. 경매는 만 19세 이상만.
  if (isMinor(user.birthYear)) return "minor";
  if (!user.phone) return "phone";
  if ((user.auctionStrikes ?? 0) >= STRIKE_LIMIT) return "strikes";
  // 판매자 본인이 값을 올리는 것(자전 입찰)을 막는다
  const artist = db.artists.find((a) => a.id === work.artistId);
  if (artist?.userId && artist.userId === user.id) return "own_work";
  if (staffEmails().has(user.email.toLowerCase())) return "staff";
  return null;
}

export const BID_BLOCK_MESSAGE: Record<Exclude<BidBlock, null>, string> = {
  login: "로그인하고 입찰할 수 있어요.",
  minor: "경매는 만 19세 이상만 참여할 수 있어요.",
  phone: "낙찰 연락을 위해 계정 설정에서 휴대폰 번호를 먼저 등록해 주세요.",
  strikes: "낙찰 후 결제하지 않은 경매가 두 번 있어 입찰할 수 없어요. 문의하기로 연락 주세요.",
  own_work: "본인 작품에는 입찰할 수 없어요.",
  staff: "MAYO 운영자는 MAYO 경매에 입찰할 수 없어요.",
};

/** 낙찰 주문을 만든다. 배송지와 입금자명은 낙찰자가 내 경매 화면에서 채운다 */
export function createAuctionOrder(db: Database, a: Auction, userId: ID, amount: number, note: string, now: Date): Order | null {
  const work = db.works.find((w) => w.id === a.workId);
  const user = db.users.find((u) => u.id === userId);
  if (!work || !user) return null;
  const artist = db.artists.find((x) => x.id === work.artistId);
  const shipping = shippingOptions(work, artShippingIds(db.categories))[0];
  const order: Order = {
    id: newId("ord"),
    userId,
    code: newOrderCode(),
    items: [{ workId: work.id, title: work.title, artistName: artist?.name ?? "", edition: work.edition, price: amount, shipping, seller: work.consignor, certificateRequestedAt: null }],
    buyer: { name: user.name, phone: user.phone ?? "", email: user.email, address: "", deliveryNote: "" },
    depositorName: user.name,
    subtotal: amount,
    parcelFee: shipping === "parcel" ? PARCEL_FEE : 0,
    shippingQuote: null,
    status: "pending_payment",
    paymentMethod: "bank_transfer",
    paymentDueAt: new Date(now.getTime() + PAYMENT_DUE_HOURS * 3600_000).toISOString(),
    paidAt: null,
    adminMemo: "",
    history: [{ at: now.toISOString(), status: "pending_payment", note }],
    createdAt: now.toISOString(),
    auctionId: a.id,
    buyerFee: buyerFee(amount, feeRate(db)),
  };
  db.orders.push(order);
  work.status = "reserved";
  work.updatedAt = now.toISOString();
  return order;
}

/** 마감 시각이 지난 경매를 닫는다 (낙찰 주문 생성 또는 유찰). 닫은 경매 id를 돌려준다 */
export function closeDue(db: Database, now: Date): ID[] {
  const closed: ID[] = [];
  for (const a of db.auctions) {
    if (a.state !== "scheduled" || now.getTime() < Date.parse(a.endsAt)) continue;
    a.state = "closed";
    a.updatedAt = now.toISOString();
    const win = hammer(a);
    const work = db.works.find((w) => w.id === a.workId);
    if (!win) {
      a.result = { kind: "no_sale", at: now.toISOString() };
      // 유찰: 정가 판매, 렌탈로 계속 판다
      if (work) work.auctionId = null;
    } else {
      const order = createAuctionOrder(db, a, win.userId, win.amount, "경매 낙찰", now);
      if (order) a.result = { kind: "sold", via: "bid", userId: win.userId, hammer: win.amount, at: now.toISOString(), orderId: order.id, payment: "pending" };
    }
    closed.push(a.id);
  }
  // 답이 없는 차순위 제안은 거둔다
  for (const a of db.auctions) {
    if (a.offer && Date.parse(a.offer.expiresAt) <= now.getTime()) {
      a.failedUserIds.push(a.offer.userId);
      a.offer = null;
      const work = db.works.find((w) => w.id === a.workId);
      if (work && work.status !== "sold") {
        work.auctionId = null;
        work.status = "available";
      }
    }
  }
  return closed;
}

/** 읽기 전에 부른다: 마감할 경매가 있을 때만 쓴다 (서버리스라 정해진 시각에 도는 작업 대신) */
export async function settleDueAuctions(): Promise<ID[]> {
  const now = Date.now();
  const db = await store.read();
  const due = db.auctions.some((a) => (a.state === "scheduled" && Date.parse(a.endsAt) <= now) || (a.offer && Date.parse(a.offer.expiresAt) <= now));
  if (!due) return [];
  return store.update((d) => closeDue(d, new Date()));
}

export type AuctionSnapshot = {
  id: ID;
  workId: ID;
  phase: AuctionPhase;
  startsAt: string;
  endsAt: string;
  extended: boolean;
  startPrice: number;
  increment: number;
  buyNowPrice: number | null;
  canBuyNow: boolean;
  price: number;
  bidCount: number;
  bidderCount: number;
  minimum: number;
  feeRate: number;
  bids: { alias: string; amount: number; at: string; auto: boolean; mine: boolean }[];
  me: { leading: boolean; max: number | null; outbid: boolean; block: BidBlock; agreed: boolean } | null;
  result: { kind: "no_sale" } | { kind: "sold"; hammer: number; payment: "pending" | "paid" | "failed"; mine: boolean; orderCode: string | null } | null;
  offer: { amount: number; expiresAt: string } | null;
};

/** 화면과 실시간 갱신이 받는 경매 상태. 다른 사람의 최대 금액과 회원 정보는 싣지 않는다 */
export function snapshot(db: Database, a: Auction, user: User | null, now = Date.now()): AuctionSnapshot {
  const { leader, price } = standing(a);
  const alias = bidderAliases(a);
  const mine = user ? a.maxes.find((m) => m.userId === user.id) : undefined;
  const work = db.works.find((w) => w.id === a.workId)!;
  const order = a.result?.kind === "sold" && user && a.result.userId === user.id ? db.orders.find((o) => o.id === (a.result as { orderId: ID }).orderId) : undefined;
  return {
    id: a.id,
    workId: a.workId,
    phase: auctionPhase(a, now),
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    extended: a.endsAt !== a.originalEndsAt,
    startPrice: a.startPrice,
    increment: a.increment,
    buyNowPrice: a.buyNowPrice,
    canBuyNow: canBuyNow(a),
    price,
    bidCount: a.bids.length,
    bidderCount: a.maxes.length,
    minimum: minimumBid(a),
    feeRate: feeRate(db),
    bids: [...a.bids]
      .reverse()
      .slice(0, 20)
      .map((b) => ({ alias: alias.get(b.userId) ?? "입찰자", amount: b.amount, at: b.at, auto: b.auto, mine: b.userId === user?.id })),
    me: user
      ? {
          leading: leader === user.id,
          max: mine?.max ?? null,
          outbid: Boolean(mine) && leader !== user.id,
          block: bidBlock(db, user, work),
          agreed: Boolean(user.auctionAgreedAt),
        }
      : null,
    result: !a.result
      ? null
      : a.result.kind === "no_sale"
        ? { kind: "no_sale" }
        : { kind: "sold", hammer: a.result.hammer, payment: a.result.payment, mine: a.result.userId === user?.id, orderCode: order?.code ?? null },
    offer: a.offer && user && a.offer.userId === user.id ? { amount: a.offer.amount, expiresAt: a.offer.expiresAt } : null,
  };
}

/** 지금 이 작품에 걸린 경매 (요청, 취소 상태는 빼고) */
export function activeAuctionFor(db: Database, workId: ID): Auction | undefined {
  const work = db.works.find((w) => w.id === workId);
  const a = work?.auctionId ? db.auctions.find((x) => x.id === work.auctionId) : undefined;
  return a && (a.state === "scheduled" || a.state === "closed") ? a : undefined;
}

export function userById(db: Database, id: ID | undefined | null) {
  return id ? (db.users.find((u) => u.id === id) ?? null) : null;
}

/** 요청 시각 (서버 컴포넌트에서 렌더 중 Date.now()를 직접 부르지 않도록) */
export function requestNow() {
  return Date.now();
}

export const OFFER_MS = OFFER_HOURS * 3600_000;
