import type {
  Artist,
  ArtistGroup,
  ArtistStatus,
  Category,
  Order,
  Packaging,
  RentalState,
  OrderStatus,
  ShippingMethod,
  VerifyMethod,
  Work,
  WorkKind,
  WorkStatus,
} from "./types";

/** 처음 시드되는 분류. 이후에는 관리자 화면에서 바꾼다. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "painting", label: "회화", order: 1, visible: true, artShipping: false },
  { id: "drawing", label: "드로잉", order: 2, visible: true, artShipping: false },
  { id: "print", label: "판화", order: 3, visible: true, artShipping: false },
  { id: "photo", label: "사진", order: 4, visible: true, artShipping: false },
  { id: "sculpture", label: "조각", order: 5, visible: true, artShipping: true },
  { id: "furniture", label: "가구", order: 6, visible: true, artShipping: true },
  { id: "metal", label: "금속공예", order: 7, visible: true, artShipping: false },
  { id: "ceramic", label: "도예", order: 8, visible: true, artShipping: false },
  { id: "textile", label: "섬유", order: 9, visible: true, artShipping: false },
  { id: "digital", label: "디지털", order: 10, visible: true, artShipping: false },
  { id: "craft", label: "공예", order: 11, visible: true, artShipping: false },
];

export const DEFAULT_ARTIST_GROUPS: ArtistGroup[] = [
  { id: "student", label: "재학생", order: 1, visible: true },
  { id: "graduate", label: "졸업생", order: 2, visible: true },
  { id: "aspiring", label: "미대 지망생", order: 3, visible: true },
  { id: "general", label: "일반 작가", order: 4, visible: true },
  { id: "late", label: "작고 작가", order: 5, visible: true },
];

export function groupLabel(groups: ArtistGroup[], id: string) {
  return groups.find((g) => g.id === id)?.label ?? ARTIST_STATUS_LABEL[id as ArtistStatus] ?? id;
}

export function isDeceased(a: Pick<Artist, "deathYear">) {
  return a.deathYear != null;
}

/** "1931–2004", 생년만 있으면 "1998–" 대신 "1998년생" */
export function lifespan(a: Pick<Artist, "birthYear" | "deathYear">) {
  if (a.deathYear != null) return `${a.birthYear ?? "?"}–${a.deathYear}`;
  return a.birthYear != null ? `${a.birthYear}년생` : null;
}

export function categoryLabel(categories: Category[], id: string) {
  return categories.find((c) => c.id === id)?.label ?? MEDIUM_LABEL[id] ?? id;
}

/** 전문 운송 대상 분류 코드 집합 */
export function artShippingIds(categories: Category[]): ReadonlySet<string> {
  return new Set(categories.filter((c) => c.artShipping).map((c) => c.id));
}

const DEFAULT_ART_SHIPPING = artShippingIds(DEFAULT_CATEGORIES);

export const MEDIUM_LABEL: Record<string, string> = {
  painting: "회화",
  drawing: "드로잉",
  print: "판화",
  photo: "사진",
  sculpture: "조각, 설치",
  furniture: "가구",
  metal: "금속공예",
  ceramic: "도예, 유리",
  textile: "섬유, 의상",
  digital: "디지털",
  craft: "공예",
};

export const KIND_LABEL: Record<WorkKind, string> = {
  graduation: "졸업작품",
  study: "습작, 연구작",
  coursework: "과제전 출품작",
  personal: "개인 작업",
  edition: "에디션",
};

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  available: "판매 중",
  reserved: "예약 중",
  sold: "판매 완료",
  hidden: "비공개",
};

export const ARTIST_STATUS_LABEL: Record<ArtistStatus, string> = {
  student: "재학생",
  graduate: "졸업생",
  aspiring: "미대 지망생",
  general: "일반 작가",
};

export const VERIFY_LABEL: Record<VerifyMethod, string> = {
  school_email: "학교 이메일",
  student_id: "학생증이나 증명서",
  roster: "졸업전시 명단",
};

export const SHIPPING_LABEL: Record<ShippingMethod, string> = {
  parcel: "일반 택배",
  art_shipping: "미술품 전문 운송",
  pickup: "직접 수령",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "입금 대기",
  paid: "입금 확인",
  preparing: "배송 준비",
  shipped: "배송 중",
  completed: "전달 완료",
  cancelled: "취소",
};

/** 일반 택배비 (가설값, 운영하며 조정). */
export const PARCEL_FEE = 5_000;

/** 주문 합계: 작품가 + 택배비 + 운송 견적 + 경매 구매 수수료 + 포장비 */
export function orderTotal(o: Pick<Order, "subtotal" | "parcelFee" | "shippingQuote" | "buyerFee" | "packagingFee">) {
  return o.subtotal + o.parcelFee + (o.shippingQuote ?? 0) + (o.buyerFee ?? 0) + (o.packagingFee ?? 0);
}

/** 주문 후 입금 기한. 경매 낙찰 결제 기한(48시간)과 맞춘다. */
export const PAYMENT_DUE_HOURS = 48;

/**
 * 100cm 이상, 20kg 이상, 조소, 설치, 가구는 미술품 전문 운송이 기본 (가이드 21장 ⑦).
 * 견적을 받은 뒤 운송비를 따로 안내한다.
 */
export function needsArtShipping(
  work: Pick<Work, "widthCm" | "heightCm" | "depthCm" | "weightKg" | "medium">,
  artShipping: ReadonlySet<string> = DEFAULT_ART_SHIPPING,
) {
  const longest = Math.max(work.widthCm, work.heightCm, work.depthCm ?? 0);
  if (longest >= 100) return true;
  if ((work.weightKg ?? 0) >= 20) return true;
  return artShipping.has(work.medium);
}

export function shippingOptions(work: Work, artShipping?: ReadonlySet<string>): ShippingMethod[] {
  const options: ShippingMethod[] = [needsArtShipping(work, artShipping) ? "art_shipping" : "parcel"];
  if (work.allowsPickup) options.push("pickup");
  return options;
}

/** 관리자 화면에서 다음으로 넘길 수 있는 상태. */
export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["shipped", "completed", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

/** 대표 이미지: 첫 사진, 없으면 첫 영상, 3D의 미리보기. */
export function coverImage(work: Pick<Work, "media">): string | undefined {
  return work.media.find((m) => m.kind === "image")?.src ?? work.media.find((m) => m.poster)?.poster ?? undefined;
}

/** 지금 장바구니로 주문할 수 있는 작품: 판매 중이고, 예시가 아니고, 경매에 올라가 있지 않은 것 */
export function isOrderable(work: Pick<Work, "status" | "sample" | "auctionId">) {
  return work.status === "available" && !work.sample && !work.auctionId;
}

/* ───────── 렌탈 (가설값, 운영하며 조정) ───────── */

/** 월 렌탈료: 작품가의 3%, 최소 1만 원, 천 원 단위 */
export function rentalMonthly(price: number) {
  return Math.max(10_000, Math.round((price * 0.03) / 1000) * 1000);
}

/** 보증금: 작품가의 30%, 반납 확인 후 돌려준다 */
export function rentalDeposit(price: number) {
  return Math.round((price * 0.3) / 1000) * 1000;
}

/** 렌탈하다 사기로 하면 낸 렌탈료의 이만큼을 작품가에서 빼 준다 */
export const RENT_TO_OWN_CREDIT = 0.5;

/** 렌탈할 수 있는 작품: 작가가 허락했고 판매 중이며 경매 중이 아닌 것 */
export function isRentable(work: Pick<Work, "status" | "sample" | "auctionId" | "rentable">) {
  return Boolean(work.rentable) && isOrderable(work);
}

/** 렌탈 목록에 보일 작품 (예시도 보이지만 신청은 isRentable만 받는다) */
export function showsRental(work: Pick<Work, "status" | "auctionId" | "rentable">) {
  return Boolean(work.rentable) && work.status === "available" && !work.auctionId;
}

/** 가볍게 사기 좋은 가격대 (첫 구매, 선물). 목록 필터와 홈 섹션 */
export const EASY_PRICE = 500_000;

export const PACKAGING_LABEL: Record<Packaging, string> = {
  basic: "기본 포장",
  gift: "선물 포장 (리본, 카드)",
  art: "미술품 전문 포장 (에어캡, 코너 보호, 나무 상자)",
};

/** 포장비. 기본 포장은 무료, 전문 포장은 작품 크기와 상관없이 한 점당 */
export const PACKAGING_FEE: Record<Packaging, number> = { basic: 0, gift: 5_000, art: 30_000 };

export const RENTAL_STATE_LABEL = {
  requested: "신청 접수",
  confirmed: "계약 확정, 설치 준비",
  active: "렌탈 중",
  returned: "반납 완료",
  purchased: "구매로 전환",
  cancelled: "취소",
} as const;

/** 렌탈 상태 흐름. 확정되면 작품을 묶고(예약), 반납이나 취소되면 푼다 */
export const RENTAL_NEXT: Record<RentalState, RentalState[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["active", "cancelled"],
  active: ["returned", "purchased"],
  returned: [],
  purchased: [],
  cancelled: [],
};

export const CONSULT_KIND_LABEL = {
  curation: "작품 추천 받기",
  rental: "공간 렌탈 (매장, 사무실)",
  exhibition: "기업 공간 전시",
  purchase: "기업 구매, 선물",
  commission: "커미션, 협업 제작",
  hire: "작가 섭외, 채용",
} as const;

export const CONSULT_STATE_LABEL = { new: "접수", proposed: "제안 드림", contracted: "계약", closed: "종료" } as const;

export function isListed(work: Work) {
  return work.status !== "hidden";
}

/**
 * 출생연도만으로 만 나이를 판단할 때는 생일이 아직 안 지났다고 보고 보수적으로 센다.
 * 만 19세 미만: 보호자 동의 필요. 만 14세 미만: 입점 신청을 받지 않는다(개인정보보호법).
 */
function minAge(birthYear: number, now: Date) {
  return now.getFullYear() - birthYear - 1;
}

export function isMinor(birthYear: number, now = new Date()) {
  return minAge(birthYear, now) < 19;
}

export function isUnder14(birthYear: number, now = new Date()) {
  return minAge(birthYear, now) < 14;
}

/** 입금 기한이 지난 입금 대기 주문인가. */
export function isPaymentOverdue(order: Pick<Order, "status" | "paymentDueAt">) {
  return order.status === "pending_payment" && Date.parse(order.paymentDueAt) < Date.now();
}

export const ORGANIZER_LABEL = {
  committee: "졸업준비위원회",
  council: "학생회",
  department: "학과, 교수",
  artist: "참여 작가",
  other: "기타",
} as const;

export const EXHIBITION_KIND_LABEL = { graduation: "졸업전시", coursework: "과제전", other: "기타 전시" } as const;

export const INQUIRY_TOPIC_LABEL = {
  purchase: "작품 구매, 주문",
  artist: "작가 입점, 정산",
  exhibition: "전시 등록, 촬영",
  partnership: "제휴, 협업 (학생회, 기업)",
  other: "기타",
} as const;

export const SUPPORT_LABEL = {
  archive: "온라인 전시 페이지(아카이브)",
  photo: "작품 촬영",
  qr: "QR 캡션 라벨",
} as const;
