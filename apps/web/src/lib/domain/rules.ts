import type {
  ArtistStatus,
  Medium,
  Order,
  OrderStatus,
  ShippingMethod,
  VerifyMethod,
  Work,
  WorkKind,
  WorkStatus,
} from "./types";

export const MEDIUM_LABEL: Record<Medium, string> = {
  painting: "회화",
  drawing: "드로잉",
  print: "판화",
  photo: "사진",
  sculpture: "조각·설치",
  furniture: "가구",
  metal: "금속공예",
  ceramic: "도예·유리",
  textile: "섬유·의상",
  digital: "디지털",
  craft: "공예",
};

export const KIND_LABEL: Record<WorkKind, string> = {
  graduation: "졸업작품",
  study: "습작·연구작",
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
  student_id: "학생증·증명서",
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

/** 일반 택배비 (가설값 — 운영하며 조정). */
export const PARCEL_FEE = 5_000;

/** 주문 후 입금 기한. 경매 낙찰 결제 기한(48시간)과 맞춘다. */
export const PAYMENT_DUE_HOURS = 48;

/**
 * 100cm 이상·20kg 이상·조소·설치·가구는 미술품 전문 운송이 기본 (가이드 21장 ⑦).
 * 견적을 받은 뒤 운송비를 따로 안내한다.
 */
export function needsArtShipping(work: Pick<Work, "widthCm" | "heightCm" | "depthCm" | "weightKg" | "medium">) {
  const longest = Math.max(work.widthCm, work.heightCm, work.depthCm ?? 0);
  if (longest >= 100) return true;
  if ((work.weightKg ?? 0) >= 20) return true;
  return work.medium === "sculpture" || work.medium === "furniture";
}

export function shippingOptions(work: Work): ShippingMethod[] {
  const options: ShippingMethod[] = [needsArtShipping(work) ? "art_shipping" : "parcel"];
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

/** 작품이 공개 목록에 보이는가. */
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
