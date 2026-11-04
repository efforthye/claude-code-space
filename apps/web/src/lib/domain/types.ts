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
export const VERIFY_METHODS = ["school_email", "student_id", "roster"] as const;
export type VerifyMethod = (typeof VERIFY_METHODS)[number];

export type Artist = {
  id: ID;
  name: string; // 사이트에 보이는 작가명 (활동명, 예명 허용)
  /** 본명. 정산, 인증용으로 관리자만 본다. 공개 카탈로그에서는 빠진다(catalog.ts). */
  realName?: string | null;
  schoolId: ID | null;
  department: string | null;
  gradYear: number | null; // 졸업(예정) 연도
  status: string; // 작가 구분 코드 (artistGroups, 관리자에서 관리)
  verifiedBy: VerifyMethod | null; // null = 미인증
  verifiedAt: string | null; // 운영자가 확인한 시각
  bio: string;
  instagram: string | null; // handle without @
  portfolioUrl: string | null; // https only
  acceptsCommission: boolean; // 주문제작
  /** 이 작가 페이지를 가진 회원 (입점 신청을 로그인한 채로 했거나 운영자가 연결) */
  userId?: ID | null;
  avatar: string | null; // 프로필 사진 (/media/… 또는 /samples/…)
  /** 작업실, 작업 환경 소개 (선택). 작품 이야기와 같은 글, 사진 칸 */
  studio: StoryBlock[];
  birthYear: number | null;
  /** 작고 연도. 값이 있으면 작고 작가, 작가 본인이 아니라 소장자나 유족이 판매한다. */
  deathYear: number | null;
  /** 작품, 저작권 관리 주체 (유족, 재단 등). 작고 작가에게만 의미가 있다. */
  estate: string | null;
  createdAt: string;
};

/** 작가 구분 (재학생, 졸업생, 작고 작가 …). 관리자 화면에서 이름, 순서, 노출을 바꾼다. */
export type ArtistGroup = {
  id: string; // 영문 코드, 바뀌지 않는다 (작가가 이 값으로 연결됨)
  label: string;
  order: number;
  visible: boolean; // 작가 목록 필터에 보일지
};

/** 장소 검색(카카오 로컬 / 우편번호 서비스)으로 고른 위치. */
export type Place = {
  name: string; // 건물, 장소 이름
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
  instagram?: string | null; // 학과, 졸업준비위원회 공식 계정 (@ 없이)
  poster?: string | null; // 포스터 이미지
  participantCount?: number | null; // 참여 인원
  /** 소개, 계정, 인원을 확인한 공개 페이지들 (조사해서 채운 경우) */
  factSources?: { label: string; url: string }[];
  /** 공개 일정에서 가져온 전시의 출처. 신청, 직접 등록한 전시는 null. */
  source?: { label: string; url: string } | null;
  createdAt: string;
};

/** 매체 분류, 그림만이 아니라 졸업작품 전 영역 (가이드 26장). */
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
/** 기본 매체 코드. 실제 분류 목록은 관리자가 바꾸는 db.categories가 기준이다. */
export type Medium = string;

/** 매체 분류(관리자 관리): 이름·순서·노출·전문 운송 여부 */
export type Category = {
  id: string; // 영문 코드, 바뀌지 않는다 (작품이 이 값으로 연결됨)
  label: string;
  order: number;
  visible: boolean;
  artShipping: boolean; // 크기와 상관없이 미술품 전문 운송 대상
};

/** 작품 구분 태그. */
export const WORK_KINDS = ["graduation", "study", "coursework", "personal", "edition"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/** available → reserved(주문 접수, 입금 대기) → sold. hidden = 비공개. */
export type WorkStatus = "available" | "reserved" | "sold" | "hidden";

/** 작품 미디어: 사진, 영상(작업 과정, 회전), 3D 모델(GLB). 첫 번째 사진이 대표 이미지. */
export const MEDIA_KINDS = ["image", "video", "model"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaItem = {
  kind: MediaKind;
  src: string;
  poster?: string | null; // 영상, 3D의 미리보기 이미지
  alt?: string | null;
};

/** 작품 이야기: 상세 페이지 아래에 글과 사진을 번갈아 싣는다 (작업 과정, 영감, 설치 사진 …). */
export type StoryBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; caption: string | null };

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
  edition: string | null; // "3/10", 판화, 사진 에디션 번호
  kind: WorkKind;
  price: number; // KRW
  status: WorkStatus;
  media: MediaItem[];
  description: string;
  story: StoryBlock[];
  allowsPickup: boolean; // 직거래(직접 수령)
  /** 운영자 본인이나 친족 소유 작품, 미술진흥법상 사전 고지 대상. */
  operatorOwned: boolean;
  /** 작가가 아닌 사람이 파는 경우의 판매자 표시 (소장자, 유족, 재단). null = 작가 본인 판매 */
  consignor: string | null;
  provenance: string | null; // 소장 이력
  appraisal: string | null; // 감정, 보증서 정보 (기관, 번호)
  featured: boolean;
  /** 작가가 마이페이지에서 올려 관리자 검수를 기다리는 작품 (검수 전엔 비공개) */
  pendingReview?: boolean;
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
  /** 주문 시점의 판매자. null = 작가 본인 (1차 거래) */
  seller: string | null;
  /** 구매자가 작품 보증서를 요청한 시각 */
  certificateRequestedAt: string | null;
  /** 운영자가 작가에게 판매 대금을 보낸 시각 */
  settledAt?: string | null;
};

export type Buyer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** 미술품 전문 운송용, 층수, 엘리베이터, 진입로. */
  deliveryNote: string;
};

export type OrderEvent = { at: string; status: OrderStatus; note: string };

export type Order = {
  id: ID;
  /** 로그인한 상태로 넣었거나 번호로 연결한 회원. 비회원이면 없음 */
  userId?: ID | null;
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
  /** 로그인한 상태로 넣었거나 번호로 연결한 회원. 비회원이면 없음 */
  userId?: ID | null;
  code: string; // 신청 현황 조회용 (J-XXXXXXXX)
  name: string; // 본명
  artistName?: string | null; // 활동명 (비우면 본명으로 보인다)
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

/** 졸업전시와 과제전 등록 신청, 졸준위, 학생회, 학과, 작가가 전시를 MAYO에 올려 달라고 요청한다. */
export type ExhibitionRequest = {
  id: ID;
  /** 로그인한 상태로 넣었거나 번호로 연결한 회원. 비회원이면 없음 */
  userId?: ID | null;
  code: string; // 신청 현황 조회용 (E-XXXXXXXX)
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
  description?: string | null; // 전시 소개
  instagram?: string | null; // 공식 계정 (@ 없이)
  /** 신청자가 올리고 게시에 동의한 포스터 (/media/…) */
  poster?: string | null;
  support: ExhibitionSupport[];
  message: string;
  state: ApplicationState;
  exhibitionId: ID | null;
  createdAt: string;
};

export const INQUIRY_TOPICS = ["purchase", "artist", "exhibition", "partnership", "other"] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

/** 문의하기. 운영자 답변은 신청 현황(/my)에서 본인이 확인한다. */
export type Inquiry = {
  id: ID;
  /** 로그인한 상태로 넣었거나 번호로 연결한 회원. 비회원이면 없음 */
  userId?: ID | null;
  code: string; // Q-XXXXXXXX
  topic: InquiryTopic;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  relatedCode: string | null; // 관련 주문이나 신청 번호
  state: "new" | "answered" | "closed";
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
};

export type Database = {
  categories: Category[];
  artistGroups: ArtistGroup[];
  certificates: Certificate[];
  users: User[];
  sessions: Session[];
  verifications: SchoolVerification[];
  /** 비밀번호 재설정 링크 (토큰은 해시로만, 30분) */
  passwordResets?: { tokenHash: string; userId: ID; expiresAt: string }[];
  /** 구글로 처음 온 사람이 출생연도와 약관 동의를 마칠 때까지 (토큰 해시, 15분) */
  oauthPending?: { tokenHash: string; sub: string; email: string; name: string; picture: string | null; expiresAt: string }[];
  settings: SiteSettings;
  schools: School[];
  artists: Artist[];
  exhibitions: Exhibition[];
  works: Work[];
  orders: Order[];
  applications: Application[];
  exhibitionRequests: ExhibitionRequest[];
  inquiries: Inquiry[];
};

/**
 * 작품 보증서 (미술진흥법상 구매자가 요구하면 발급). 발급 시점의 작품 정보를 그대로 굳혀 둔다,
 * 나중에 작품 정보가 바뀌어도 보증서 내용은 바뀌지 않는다. 취소는 지우지 않고 revokedAt으로 남긴다.
 */
export type Certificate = {
  id: ID;
  code: string; // 공개 확인용 (C-XXXXXXXX)
  orderId: ID;
  orderCode: string;
  workId: ID;
  work: {
    title: string;
    artistName: string;
    artistLifespan: string | null;
    year: number;
    medium: string; // 분류 이름
    materials: string;
    size: string;
    edition: string | null;
    image: string | null;
    provenance: string | null;
    appraisal: string | null;
  };
  seller: string; // 작가 본인이면 작가명
  buyerName: string; // 공개 화면에서는 가린다
  price: number;
  soldAt: string; // 입금 확인 시각
  issuedAt: string;
  issuer: { companyName: string; registrationNumber: string; artServiceNumber: string };
  revokedAt: string | null;
  revokeReason: string | null;
};

/** 회원. 비밀번호는 scrypt 해시로만 저장한다 (features/account/password.ts). */
export type User = {
  id: ID;
  email: string; // 소문자로 정규화
  name: string;
  phone: string | null;
  birthYear: number;
  passwordHash: string; // 구글로만 가입한 회원은 "" (비밀번호 로그인 불가)
  /** 구글 계정 고유 번호 (sub). 구글 로그인으로 가입했거나 계정 설정에서 연결한 경우 */
  googleSub?: string | null;
  avatar?: string | null; // 프로필 사진
  cover?: string | null; // 프로필 배경 이미지
  bio?: string | null; // 한 줄 소개
  /** 운영자가 확인한 학교 소속 (학교 인증). 없으면 미인증 */
  verification?: { schoolId: ID; department: string | null; status: "student" | "graduate"; method: VerifyMethod; verifiedAt: string } | null;
  createdAt: string;
  agreedAt: string; // 약관, 개인정보 동의 시각
};

/**
 * 로그인 세션. 쿠키에는 무작위 토큰을, 여기에는 그 SHA-256만 둔다
 * (저장소가 새어도 세션을 가로챌 수 없도록).
 */
export type Session = {
  tokenHash: string;
  userId: ID;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string; // 절대 만료
};

/**
 * 회원의 학교 인증 요청. 학생증 사진은 공개 폴더가 아닌 비공개 저장소에 두고(document),
 * 운영자가 승인하거나 반려하는 즉시 지운다.
 */
export type SchoolVerification = {
  id: ID;
  userId: ID;
  schoolName: string;
  department: string;
  status: "student" | "graduate";
  method: VerifyMethod;
  schoolEmail: string | null; // 학교 이메일로 확인할 때
  document: string | null; // 비공개 파일 이름 (학생증, 증명서)
  rosterNote: string | null; // 졸업전시 명단으로 확인할 때: 전시 이름 등
  /** 학교 이메일 확인 링크 (해시만 저장, 3일) */
  emailTokenHash?: string | null;
  emailTokenExpiresAt?: string | null;
  emailConfirmedAt?: string | null;
  state: "new" | "approved" | "rejected";
  reason: string | null; // 반려 사유
  createdAt: string;
  decidedAt: string | null;
};

/** 로고 마크: 스테인드글라스 m 또는 액자 속 그림 m. 관리자 설정에서 고른다. */
export const LOGO_MARKS = ["glass", "painting"] as const;
export type LogoMark = (typeof LOGO_MARKS)[number];

/** 운영자가 관리자 화면에서 바꾸는 사이트 설정 */
export type SiteSettings = {
  logoMark: LogoMark;
};
