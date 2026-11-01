import { describe, expect, it } from "vitest";
import { buildSampleDatabase } from "@/lib/data/sample";
import type { Order } from "@/lib/domain/types";
import { buildCertificate, maskName } from "./build";

const ctx = { id: "cert-1", code: "C-TEST", now: "2026-11-03T00:00:00Z", issuer: { companyName: "크레이프", registrationNumber: "000", artServiceNumber: "등록 예정" } };

function paidOrder(over: Partial<Order> = {}): Order {
  return {
    id: "o1", code: "MAYO-T", buyer: { name: "박혜림", phone: "", email: "", address: "", deliveryNote: "" }, depositorName: "", subtotal: 0, parcelFee: 0,
    shippingQuote: null, status: "paid", paymentMethod: "bank_transfer", paymentDueAt: "", paidAt: "2026-11-02T00:00:00Z", adminMemo: "", history: [], createdAt: "",
    items: [{ workId: "w-red-roofs", title: "붉은 지붕", artistName: "오명수", edition: null, price: 2_400_000, shipping: "parcel", seller: "작가 유족", certificateRequestedAt: null }],
    ...over,
  };
}

describe("작품 보증서", () => {
  it("freezes the work, the seller and the provenance at issue time", () => {
    const db = buildSampleDatabase();
    const cert = buildCertificate(db, paidOrder(), "w-red-roofs", ctx);
    expect(cert).toMatchObject({
      code: "C-TEST",
      seller: "작가 유족",
      price: 2_400_000,
      work: { title: "붉은 지붕", artistLifespan: "1938–2011", year: 1987, medium: "회화", provenance: expect.stringContaining("유족 소장") },
    });
  });
  it("refuses unpaid, cancelled, foreign and duplicate requests", () => {
    const db = buildSampleDatabase();
    expect(buildCertificate(db, paidOrder({ paidAt: null }), "w-red-roofs", ctx)).toHaveProperty("error");
    expect(buildCertificate(db, paidOrder({ status: "cancelled" }), "w-red-roofs", ctx)).toHaveProperty("error");
    expect(buildCertificate(db, paidOrder(), "w-other", ctx)).toHaveProperty("error");
    const first = buildCertificate(db, paidOrder(), "w-red-roofs", ctx);
    db.certificates.push(first as never);
    expect(buildCertificate(db, paidOrder(), "w-red-roofs", ctx)).toEqual({ error: "이미 유효한 보증서가 있어요" });
    // 취소된 보증서가 있으면 다시 발급할 수 있다
    db.certificates[0].revokedAt = "2026-11-04T00:00:00Z";
    expect(buildCertificate(db, paidOrder(), "w-red-roofs", { ...ctx, code: "C-NEW" })).toHaveProperty("code", "C-NEW");
  });
  it("masks the buyer's name for the public page", () => {
    expect(maskName("박혜림")).toBe("박*림");
    expect(maskName("남궁민수")).toBe("남**수");
    expect(maskName("김민")).toBe("김*");
    expect(maskName("Lee")).toBe("L*e");
  });
});
