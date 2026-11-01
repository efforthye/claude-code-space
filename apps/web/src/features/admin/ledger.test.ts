import { describe, expect, it } from "vitest";
import { buildBaseDatabase } from "@/lib/data/base";
import type { Order } from "@/lib/domain/types";
import { buildLedger } from "./ledger";

const order = (over: Partial<Order>): Order => ({
  id: "o", code: "MAYO-AAAAAAAA", items: [{ workId: "w", title: "작품", artistName: "작가", edition: "1/5", price: 100_000, shipping: "parcel", seller: null, certificateRequestedAt: null }],
  buyer: { name: "", phone: "", email: "", address: "", deliveryNote: "" }, depositorName: "", subtotal: 100_000, parcelFee: 0,
  shippingQuote: null, status: "pending_payment", paymentMethod: "bank_transfer", paymentDueAt: "", paidAt: null,
  adminMemo: "", history: [], createdAt: "2026-11-01T00:00:00Z", ...over,
});

describe("유통 내역", () => {
  it("records only paid orders, newest first", () => {
    const db = buildBaseDatabase();
    db.orders = [
      order({ id: "1", code: "MAYO-1", paidAt: null }),
      order({ id: "2", code: "MAYO-2", status: "paid", paidAt: "2026-11-02T00:00:00Z" }),
      order({ id: "3", code: "MAYO-3", status: "completed", paidAt: "2026-11-05T00:00:00Z" }),
    ];
    const rows = buildLedger(db);
    expect(rows.map((r) => r.orderCode)).toEqual(["MAYO-3", "MAYO-2"]);
    expect(rows[0]).toMatchObject({ edition: "1/5", price: 100_000, seller: "작가", type: "1차 판매" });
  });
  it("keeps a cancelled-after-payment sale on record with its status", () => {
    const db = buildBaseDatabase();
    db.orders = [order({ status: "cancelled", paidAt: "2026-11-02T00:00:00Z" })];
    expect(buildLedger(db)[0].orderStatus).toBe("cancelled");
  });
  it("names the consignor as seller and marks the sale as secondary", () => {
    const db = buildBaseDatabase();
    const o = order({ status: "paid", paidAt: "2026-11-02T00:00:00Z" });
    o.items[0].seller = "작가 유족";
    db.orders = [o];
    expect(buildLedger(db)[0]).toMatchObject({ seller: "작가 유족", artist: "작가", type: "2차 판매 (위탁)", certificate: "" });
  });
});
