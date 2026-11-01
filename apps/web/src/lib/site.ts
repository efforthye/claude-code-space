export const siteConfig = {
  name: "MAYO",
  tagline: "My Art, Your Object",
  description:
    "졸업전시장의 작품을 믿고 살 수 있는 첫 원화로. 학생 인증 작가의 회화부터 가구·의상·조각·금속공예까지.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://mayo.im",
};

/**
 * 전자상거래법상 사이버몰 운영자 표시 항목. 값은 Vercel 환경변수로만 넣는다
 * (공개 정보지만 저장소에는 두지 않는다). 비어 있으면 "등록 예정"으로 보인다.
 */
export function getBusinessInfo() {
  const pending = "등록 예정";
  return {
    companyName: process.env.BUSINESS_NAME ?? "크레이프(Creiip)",
    representative: process.env.BUSINESS_REPRESENTATIVE ?? pending,
    registrationNumber: process.env.BUSINESS_REG_NO ?? pending,
    mailOrderNumber: process.env.BUSINESS_MAIL_ORDER_NO ?? pending,
    artServiceNumber: process.env.BUSINESS_ART_SERVICE_NO ?? pending,
    address: process.env.BUSINESS_ADDRESS ?? pending,
    phone: process.env.BUSINESS_PHONE ?? pending,
    email: process.env.BUSINESS_EMAIL ?? pending,
    hosting: "Vercel Inc.",
  };
}
