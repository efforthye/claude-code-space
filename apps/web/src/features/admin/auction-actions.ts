"use server";

import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/data/catalog";
import { store } from "@/lib/data/store";
import { kstToIso, nextBidder, staggeredEnds } from "@/lib/domain/auction";
import { isOrderable } from "@/lib/domain/rules";
import type { Auction, Database } from "@/lib/domain/types";
import { newId } from "@/lib/ids";
import { OFFER_MS } from "@/features/auction/server";
import { notifyAuction } from "@/features/mail/notify";
import { requireAdmin } from "./session";
import type { FormState } from "./actions";

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
const won = (form: FormData, k: string) => Number(s(form, k).replace(/[^\d]/g, "")) || 0;

/** datetime-local 값("2026-11-09T10:00")은 한국 시각으로 읽는다 */
const kst = (v: string) => (v ? kstToIso(v.slice(0, 10), v.slice(11, 16)) : "");

function done() {
  updateTag(TAG.catalog);
  refresh();
}

function readTerms(form: FormData) {
  const startPrice = won(form, "startPrice");
  const increment = won(form, "increment");
  const buyNow = won(form, "buyNowPrice");
  if (startPrice < 1000) throw new Error("시작가를 확인해 주세요");
  if (increment < 1000) throw new Error("입찰 단위를 확인해 주세요");
  if (buyNow && buyNow <= startPrice) throw new Error("즉시구매가는 시작가보다 커야 해요");
  return { startPrice, increment, buyNowPrice: buyNow || null };
}

function readDates(form: FormData) {
  const startsAt = kst(s(form, "startsAt"));
  const endsAt = kst(s(form, "endsAt"));
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("시작과 마감 시각을 확인해 주세요");
  return { startsAt, endsAt };
}

function attach(db: Database, a: Auction) {
  const work = db.works.find((w) => w.id === a.workId);
  if (!work || !isOrderable(work)) throw new Error("판매 중인 작품만 경매에 올릴 수 있어요 (예시, 예약, 판매 완료, 다른 경매 중인 작품 제외)");
  work.auctionId = a.id;
  work.updatedAt = new Date().toISOString();
  a.exhibitionId ??= work.exhibitionId;
}

/** 운영자가 작품을 바로 경매에 올린다 */
export async function createAuction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const terms = readTerms(form);
    const dates = readDates(form);
    await store.update((db) => {
      const now = new Date().toISOString();
      const a: Auction = {
        id: newId("auc"),
        workId: s(form, "workId"),
        exhibitionId: null,
        ...terms,
        ...dates,
        originalEndsAt: dates.endsAt,
        state: "scheduled",
        requestedBy: "admin",
        bids: [],
        maxes: [],
        result: null,
        failedUserIds: [],
        offer: null,
        createdAt: now,
        updatedAt: now,
      };
      attach(db, a);
      db.auctions.push(a);
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  done();
  return null;
}

/** 작가가 신청한 경매에 일정을 정해 연다 (시작가 등은 그대로, 필요하면 고친다) */
export async function scheduleRequested(auctionId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const terms = readTerms(form);
    const dates = readDates(form);
    await store.update((db) => {
      const a = db.auctions.find((x) => x.id === auctionId);
      if (!a || a.state !== "requested") throw new Error("이미 처리된 신청이에요");
      Object.assign(a, terms, dates, { originalEndsAt: dates.endsAt, state: "scheduled", updatedAt: new Date().toISOString() });
      attach(db, a);
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  done();
  return null;
}

/** 입찰이 없는 경매만 취소할 수 있다 (입찰이 들어온 경매를 운영자가 지우면 공정성이 깨진다) */
export async function cancelAuction(auctionId: string) {
  await requireAdmin();
  await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    if (!a || a.bids.length > 0 || (a.state !== "requested" && a.state !== "scheduled")) return;
    a.state = "cancelled";
    a.updatedAt = new Date().toISOString();
    const work = db.works.find((w) => w.id === a.workId);
    if (work?.auctionId === a.id) work.auctionId = null;
  });
  done();
}

/**
 * 전시 경매 일정 한 번에: 전시 첫날 10시 시작, 마지막 날 first(18:00)부터 2분 간격 순차 마감.
 * 아직 입찰이 없는 예정 경매만 바꾼다.
 */
export async function scheduleExhibition(exhibitionId: string, form: FormData) {
  await requireAdmin();
  const first = /^\d{2}:\d{2}$/.test(s(form, "first")) ? s(form, "first") : "18:00";
  await store.update((db) => {
    const e = db.exhibitions.find((x) => x.id === exhibitionId);
    if (!e) return;
    const rows = db.auctions
      .filter((a) => a.state === "scheduled" && a.bids.length === 0 && (a.exhibitionId ?? db.works.find((w) => w.id === a.workId)?.exhibitionId) === exhibitionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ends = staggeredEnds(e.endDate, rows.length, first);
    rows.forEach((a, i) => {
      a.startsAt = kstToIso(e.startDate, "10:00");
      a.endsAt = a.originalEndsAt = ends[i];
      a.updatedAt = new Date().toISOString();
    });
  });
  done();
}

/**
 * 낙찰자 미결제: 주문 취소, 미결제 횟수 +1, 다음 입찰자에게 그 사람의 최대 금액으로 24시간 구매 제안.
 * 다음 입찰자가 없으면 작품은 정가 판매로 돌아간다.
 */
export async function failAuctionPayment(auctionId: string) {
  await requireAdmin();
  const offered = await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    if (!a || a.result?.kind !== "sold" || a.result.payment !== "pending") return null;
    const now = new Date();
    const r = a.result;
    r.payment = "failed";
    a.failedUserIds.push(r.userId);
    const user = db.users.find((u) => u.id === r.userId);
    if (user) user.auctionStrikes = (user.auctionStrikes ?? 0) + 1;
    const order = db.orders.find((o) => o.id === r.orderId);
    if (order && order.status === "pending_payment") {
      order.status = "cancelled";
      order.history.push({ at: now.toISOString(), status: "cancelled", note: "경매 낙찰 미결제로 취소" });
    }
    const work = db.works.find((w) => w.id === a.workId);
    const next = nextBidder(a);
    if (next) {
      a.offer = { userId: next.userId, amount: next.max, expiresAt: new Date(now.getTime() + OFFER_MS).toISOString() };
      return { userId: next.userId, workId: a.workId, amount: next.max };
    }
    if (work) {
      work.status = "available";
      work.auctionId = null;
    }
    return null;
  });
  if (offered) notifyAuction(offered.userId, offered.workId, "offer", offered.amount);
  done();
}

/** 작가가 마이페이지에서 경매 신청을 거절당했을 때처럼, 신청만 지운다 */
export async function rejectAuctionRequest(auctionId: string) {
  await requireAdmin();
  await store.update((db) => {
    const a = db.auctions.find((x) => x.id === auctionId);
    if (a?.state === "requested") a.state = "cancelled";
  });
  done();
}

/** 구매 수수료율 (%) */
export async function setAuctionFee(form: FormData) {
  await requireAdmin();
  const pct = Number(s(form, "feePercent"));
  if (!Number.isFinite(pct) || pct < 0 || pct > 30) return;
  await store.update((db) => {
    db.settings.auctionBuyerFeeRate = Math.round(pct * 10) / 1000;
  });
  done();
}
