/**
 * MAYO domain model. Field names and enums follow the feature spec
 * (SNS 마케팅 실전 가이드 11장) so the admin and public pages speak the same language.
 */

export type ID = string;

export type School = {
  id: ID;
  name: string; // 홍익대학교
  shortName: string; // 홍익대
};

export type ArtistStatus = "student" | "graduate" | "aspiring" | "general";

/** How the operator confirmed the school affiliation (학교 인증 딱지). */
export type VerifyMethod = "school_email" | "student_id" | "roster";

export type Artist = {
  id: ID;
  name: string; // 작가명(예명 허용)
  schoolId: ID | null;
  department: string | null;
  gradYear: number | null; // 졸업(예정) 연도
  status: ArtistStatus;
  verifiedBy: VerifyMethod | null; // null = 미인증
  verifiedAt: string | null; // 운영자가 확인한 시각
  bio: string;
  instagram: string | null; // handle without @
  portfolioUrl: string | null; // https only
  acceptsCommission: boolean; // 주문제작
  createdAt: string;
};

/** 장소 검색(카카오 로컬 / 우편번호 서비스)으로 고른 위치. */
export type Place = {
  name: string; // 건물·장소 이름
  address: string | null; // 도로명 주소
  lat: number | null;
  lng: number | null;
  url: string | null; // 지도 링크
};

export type Exhibition = {
  id: ID;
  title: string;
  schoolId: ID | null;
  department: string | null;
  venue: string; // 표시용: 장소 이름 + 상세 위치
  place?: Place | null; // 검색으로 고른 위치 (공개 일정에서 가져온 전시는 없음)
  startDate: string; // YYYY-MM-DD
  endDate: string;
  description: string;
  link: string | null;
  hours?: string | null; // 관람 시간
  opening?: string | null; // 오프닝
  note?: string | null; // 출처끼리 다른 점 등 안내
  /** 공개 일정에서 가져온 전시의 출처. 신청·직접 등록한 전시는 null. */
  source?: { label: string; url: string } | null;
  createdAt: string;
};

/** 매체 분류 — 그림만이 아니라 졸업작품 전 영역 (가이드 26장). */
export const MEDIA = [
  "painting",
  "drawing",
  "print",
  "photo",
  "sculpture",
  "furniture",
  "metal",
  "ceramic",
  "textile",
  "digital",
  "craft",
] as const;
export type Medium = (typeof MEDIA)[number];

/** 작품 구분 태그. */
export const WORK_KINDS = ["graduation", "study", "coursework", "personal", "edition"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/** available → reserved(주문 접수, 입금 대기) → sold. hidden = 비공개. */
export type WorkStatus = "available" | "reserved" | "sold" | "hidden";

export type Work = {
  id: ID;
  title: string;
  artistId: ID;
  exhibitionId: ID | null;
  medium: Medium;
  materials: string; // "캔버스에 아크릴"
  widthCm: number;
  heightCm: number;
  depthCm: number | null;
  weightKg: number | null;
  year: number;
  edition: string | null; // "3/10" — 판화·사진 에디션 번호
  kind: WorkKind;
  price: number; // KRW
  status: WorkStatus;
  images: string[]; // first = 대표 이미지
  description: string;
  allowsPickup: boolean; // 직거래(직접 수령)
  /** 운영자 본인·친족 소유 작품 — 미술진흥법상 사전 고지 대상. */
  operatorOwned: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShippingMethod = "parcel" | "art_shipping" | "pickup";

export type OrderStatus =
  | "pending_payment" // 주문 접수, 입금 대기
  | "paid" // 입금 확인
  | "preparing" // 배송 준비
  | "shipped" // 배송 중
  | "completed" // 전달 완료
  | "cancelled";

export type OrderItem = {
  workId: ID;
  title: string;
  artistName: string;
  edition: string | null;
  price: number;
  shipping: ShippingMethod;
};

export type Buyer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** 미술품 전문 운송용 — 층수·엘리베이터·진입로. */
  deliveryNote: string;
};

export type OrderEvent = { at: string; status: OrderStatus; note: string };

export type Order = {
  id: ID;
  code: string; // 고객에게 보여주는 주문번호
  items: OrderItem[];
  buyer: Buyer;
  depositorName: string; // 입금자명
  subtotal: number;
  /** 일반 택배비. 전문 운송은 견적 후 shippingQuote로 따로 받는다. */
  parcelFee: number;
  shippingQuote: number | null;
  status: OrderStatus;
  paymentMethod: "bank_transfer";
  paymentDueAt: string;
  paidAt: string | null;
  adminMemo: string;
  history: OrderEvent[];
  createdAt: string;
};

export type ApplicationState = "new" | "approved" | "rejected";

/** 작가 입점 신청. */
export type Application = {
  id: ID;
  name: string;
  email: string;
  phone: string;
  status: ArtistStatus;
  schoolName: string;
  department: string;
  gradYear: number | null;
  birthYear: number;
  guardian: { name: string; phone: string } | null; // 만 19세 미만 필수
  instagram: string | null;
  portfolioUrl: string | null;
  message: string;
  state: ApplicationState;
  artistId: ID | null; // 승인 시 생성된 작가
  createdAt: string;
};

export type ExhibitionKind = "graduation" | "coursework" | "other";
export type ExhibitionSupport = "archive" | "photo" | "qr";

/** 졸업·과제전시 등록 신청 — 졸준위·학생회·학과·작가가 전시를 MAYO에 올려 달라고 요청한다. */
export type ExhibitionRequest = {
  id: ID;
  organizer: "committee" | "council" | "department" | "artist" | "other";
  contactName: string;
  email: string;
  phone: string;
  schoolName: string;
  department: string;
  title: string;
  kind: ExhibitionKind;
  startDate: string;
  endDate: string;
  venue: string;
  place: Place | null;
  artistCount: number | null;
  support: ExhibitionSupport[];
  message: string;
  state: ApplicationState;
  exhibitionId: ID | null;
  createdAt: string;
};

export type Database = {
  schools: School[];
  artists: Artist[];
  exhibitions: Exhibition[];
  works: Work[];
  orders: Order[];
  applications: Application[];
  exhibitionRequests: ExhibitionRequest[];
};
