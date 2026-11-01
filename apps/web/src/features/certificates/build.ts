import { categoryLabel, coverImage, lifespan } from "@/lib/domain/rules";
import type { Certificate, Database, Order } from "@/lib/domain/types";
import { formatSize } from "@/lib/format";

export type Issuer = Certificate["issuer"];

/**
 * 주문 한 줄에 대한 보증서를 만든다. 입금이 확인되고 취소되지 않은 주문만, 같은 작품에 유효한 보증서는 하나만.
 * 저장소에 쓰지 않는 순수 함수라 store.update 안에서 부른다.
 */
export function buildCertificate(
  db: Database,
  order: Order,
  workId: string,
  ctx: { id: string; code: string; now: string; issuer: Issuer },
): Certificate | { error: string } {
  if (!order.paidAt || order.status === "cancelled") return { error: "입금이 확인된 주문에만 보증서를 발급할 수 있어요" };
  const item = order.items.find((i) => i.workId === workId);
  if (!item) return { error: "주문에 없는 작품이에요" };
  if (db.certificates.some((c) => c.orderId === order.id && c.workId === workId && !c.revokedAt)) return { error: "이미 유효한 보증서가 있어요" };
  const work = db.works.find((w) => w.id === workId);
  if (!work) return { error: "작품 정보를 찾을 수 없어요" };
  const artist = db.artists.find((a) => a.id === work.artistId);

  return {
    id: ctx.id,
    code: ctx.code,
    orderId: order.id,
    orderCode: order.code,
    workId,
    work: {
      title: item.title,
      artistName: item.artistName,
      artistLifespan: artist ? lifespan(artist) : null,
      year: work.year,
      medium: categoryLabel(db.categories, work.medium),
      materials: work.materials,
      size: formatSize(work.widthCm, work.heightCm, work.depthCm),
      edition: item.edition,
      image: coverImage(work) ?? null,
      provenance: work.provenance,
      appraisal: work.appraisal,
    },
    seller: item.seller ?? item.artistName,
    buyerName: order.buyer.name,
    price: item.price,
    soldAt: order.paidAt,
    issuedAt: ctx.now,
    issuer: ctx.issuer,
    revokedAt: null,
    revokeReason: null,
  };
}

/** 공개 확인 화면용: 박혜림 → 박*림, 김민 → 김*, 외자 이름은 그대로 첫 글자만 */
export function maskName(name: string) {
  const chars = [...name.trim()];
  if (chars.length <= 1) return chars.join("");
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars.at(-1)}`;
}
