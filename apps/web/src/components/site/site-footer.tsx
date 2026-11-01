import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/lib/data/catalog";
import { getBusinessInfo, siteConfig } from "@/lib/site";
import { LabeledValue, MetaLine } from "@/components/ui/meta-line";

export async function SiteFooter() {
  const biz = getBusinessInfo();
  const { logoMark } = await getSiteSettings();
  return (
    <footer className="mt-20 print:hidden border-t border-white/80 bg-white/55 py-10 text-xs leading-relaxed text-ink-soft backdrop-blur">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="flex items-baseline gap-3 leading-none">
            <Logo mark={logoMark} className="text-[30px]" />
            <i className="font-display text-lg text-ink-soft">{siteConfig.tagline}</i>
          </p>
          <nav className="flex gap-4 font-semibold text-ink">
            <Link href="/legal/terms">이용약관</Link>
            <Link href="/legal/privacy">개인정보처리방침</Link>
            <Link href="/account">마이페이지</Link>
            <Link href="/my">비회원 주문 조회</Link>
            <Link href="/contact">문의하기</Link>
            <Link href="/join">작가 입점 신청</Link>
          </nav>
        </div>
        <p className="rounded-sm bg-white/70 p-3 text-ink">
          MAYO는 통신판매중개자로서 작가가 직접 판매하는 거래의 당사자가 아닙니다. 작품 정보와 거래에 대한 1차 책임은 각
          판매자(작가)에게 있습니다.
        </p>
        <div className="flex flex-col gap-1.5">
          <MetaLine>
            <LabeledValue label="상호">{biz.companyName}</LabeledValue>
            <LabeledValue label="대표">{biz.representative}</LabeledValue>
            <LabeledValue label="사업자등록번호">{biz.registrationNumber}</LabeledValue>
            {biz.ftcUrl && <a href={biz.ftcUrl} target="_blank" rel="noopener noreferrer" className="link-sweep font-semibold text-ink">사업자정보 확인</a>}
          </MetaLine>
          <MetaLine>
            <LabeledValue label="통신판매업 신고">{biz.mailOrderNumber}</LabeledValue>
            <LabeledValue label="미술서비스업 신고">{biz.artServiceNumber}</LabeledValue>
            <LabeledValue label="호스팅">{biz.hosting}</LabeledValue>
          </MetaLine>
          <MetaLine>
            <LabeledValue label="주소">{biz.address}</LabeledValue>
          </MetaLine>
          <MetaLine>
            <LabeledValue label="고객센터">{biz.phone}</LabeledValue>
            {biz.email !== biz.phone && <LabeledValue label="이메일">{biz.email}</LabeledValue>}
          </MetaLine>
        </div>
      </Container>
    </footer>
  );
}
