import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getBusinessInfo, siteConfig } from "@/lib/site";

export function SiteFooter() {
  const biz = getBusinessInfo();
  return (
    <footer className="mt-20 border-t border-white/80 bg-white/55 py-10 text-xs leading-relaxed text-ink-soft backdrop-blur">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-3xl leading-none text-ink">
            mayo <i className="text-lg text-ink-soft">{siteConfig.tagline}</i>
          </p>
          <nav className="flex gap-4 font-semibold text-ink">
            <Link href="/legal/terms">이용약관</Link>
            <Link href="/legal/privacy">개인정보처리방침</Link>
            <Link href="/my">내 신청 현황</Link>
            <Link href="/contact">문의하기</Link>
            <Link href="/join">작가 입점 신청</Link>
          </nav>
        </div>
        <p className="rounded-sm bg-white/70 p-3 text-ink">
          MAYO는 통신판매중개자로서 작가가 직접 판매하는 거래의 당사자가 아닙니다. 작품 정보와 거래에 대한 1차 책임은 각
          판매자(작가)에게 있습니다.
        </p>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div><dt className="inline">상호 </dt><dd className="inline">{biz.companyName}</dd> · <dt className="inline">대표 </dt><dd className="inline">{biz.representative}</dd></div>
          <div><dt className="inline">사업자등록번호 </dt><dd className="inline">{biz.registrationNumber}</dd></div>
          <div><dt className="inline">통신판매업 신고 </dt><dd className="inline">{biz.mailOrderNumber}</dd></div>
          <div><dt className="inline">미술서비스업 신고 </dt><dd className="inline">{biz.artServiceNumber}</dd></div>
          <div><dt className="inline">주소 </dt><dd className="inline">{biz.address}</dd></div>
          <div><dt className="inline">고객센터 </dt><dd className="inline">{biz.phone} · {biz.email}</dd></div>
          <div><dt className="inline">호스팅 </dt><dd className="inline">{biz.hosting}</dd></div>
        </dl>
      </Container>
    </footer>
  );
}
