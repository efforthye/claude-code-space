import { cookies } from "next/headers";
import { buildLedger } from "@/features/admin/ledger";
import { ADMIN_COOKIE, isValidSession } from "@/features/admin/session";
import { store } from "@/lib/data/store";
import { csvCell } from "@/lib/security/csv";
import { siteConfig } from "@/lib/site";


export async function GET() {
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rows = buildLedger(await store.read());
  const header = ["거래일시", "주문번호", "작품명", "에디션", "금액", "판매자", "작가", "작품사진", "유형", "주문상태", "보증서"];
  const lines = rows.map((r) =>
    [r.paidAt, r.orderCode, r.title, r.edition, r.price, r.seller, r.artist, r.image.startsWith("/") ? siteConfig.url + r.image : r.image, r.type, r.orderStatus, r.certificate]
      .map(csvCell)
      .join(","),
  );
  // BOM: 엑셀에서 한글이 깨지지 않게
  const body = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mayo-ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
