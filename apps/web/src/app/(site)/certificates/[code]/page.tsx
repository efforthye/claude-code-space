import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { SealIcon } from "@/components/ui/verified-badge";
import { maskName } from "@/features/certificates/build";
import { findCertificate } from "@/features/certificates/queries";
import { formatDate, formatPrice } from "@/lib/format";
import { siteConfig } from "@/lib/site";

// 보증서 주소는 구매자에게만 전달된다. 검색에 노출하지 않는다.
export const metadata: Metadata = { title: "작품 보증서", robots: { index: false, follow: false } };

export default function CertificatePage(props: PageProps<"/certificates/[code]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">보증서를 확인하는 중…</Container>}>
      <CertificateView params={props.params} />
    </Suspense>
  );
}

async function CertificateView({ params }: { params: PageProps<"/certificates/[code]">["params"] }) {
  const { code } = await params;
  const cert = await findCertificate(decodeURIComponent(code));
  if (!cert) notFound();
  const url = `${siteConfig.url}/certificates/${cert.code}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1d1530", light: "#ffffff00" } });
  const valid = !cert.revokedAt;
  const w = cert.work;

  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-12 print:py-0">
      <div
        role="status"
        className={valid ? "glass flex items-center gap-3 rounded-lg p-4 print:hidden" : "flex flex-col gap-1 rounded-lg bg-dot/10 p-4 text-dot print:border print:border-dot"}
      >
        {valid ? (
          <>
            <SealIcon className="size-7" />
            <p className="text-sm"><b>유효한 보증서</b>예요. MAYO 기록과 일치합니다.</p>
          </>
        ) : (
          <>
            <p className="font-bold">취소된 보증서예요</p>
            <p className="text-sm">{formatDate(cert.revokedAt!)}에 취소됐어요. 사유: {cert.revokeReason}</p>
          </>
        )}
      </div>

      <article className="glass relative flex flex-col gap-8 overflow-hidden rounded-xl p-6 sm:p-10 print:rounded-none print:shadow-none">
        <span aria-hidden className="bg-aurora absolute -top-24 -right-24 size-64 rounded-full opacity-20 blur-3xl print:hidden" />
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-6">
          <div className="flex flex-col gap-1">
            <span className="font-display text-lg text-violet italic">Certificate of Authenticity</span>
            <h1 className="text-2xl font-bold">작품 보증서</h1>
          </div>
          <dl className="text-right text-xs">
            <dt className="text-ink-soft">보증서 번호</dt>
            <dd className="font-mono text-sm font-semibold">{cert.code}</dd>
          </dl>
        </header>

        <div className="grid gap-8 sm:grid-cols-[1fr_1.3fr]">
          {w.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.image} alt={`「${w.title}」`} className="w-full rounded-lg object-contain" />
          )}
          <dl className="grid grid-cols-[5.5rem_1fr] content-start gap-x-4 gap-y-2.5 text-sm">
            <Row label="작품명">「{w.title}」</Row>
            <Row label="작가">{w.artistName}{w.artistLifespan && ` (${w.artistLifespan})`}</Row>
            <Row label="제작 연도">{w.year}년</Row>
            <Row label="분류">{w.medium}</Row>
            <Row label="재료">{w.materials}</Row>
            <Row label="크기">{w.size}</Row>
            {w.edition && <Row label="에디션">{w.edition}</Row>}
            {w.provenance && <Row label="소장 이력"><span className="whitespace-pre-line">{w.provenance}</span></Row>}
            {w.appraisal && <Row label="감정">{w.appraisal}</Row>}
          </dl>
        </div>

        <dl className="grid gap-x-4 gap-y-2.5 border-t border-ink/15 pt-6 text-sm sm:grid-cols-[5.5rem_1fr_5.5rem_1fr]">
          <Row label="판매자">{cert.seller}</Row>
          <Row label="구매자">{maskName(cert.buyerName)}</Row>
          <Row label="거래일">{formatDate(cert.soldAt)}</Row>
          <Row label="거래 금액">{formatPrice(cert.price)}</Row>
          <Row label="발급일">{formatDate(cert.issuedAt)}</Row>
          <Row label="주문번호"><span className="font-mono">{cert.orderCode.replace(/.{4}$/, "****")}</span></Row>
        </dl>

        <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-ink/15 pt-6">
          <div className="flex flex-col gap-1 text-xs text-ink-soft">
            <p className="font-semibold text-ink">발급 {cert.issuer.companyName} (MAYO)</p>
            <p>사업자등록번호 {cert.issuer.registrationNumber}</p>
            <p>미술서비스업 신고 {cert.issuer.artServiceNumber}</p>
            <p className="mt-2 max-w-sm leading-relaxed">
              MAYO가 거래 기록과 판매자가 제출한 정보로 확인한 내용이에요. 오른쪽 QR이나 {siteConfig.url.replace(/^https?:\/\//, "")}/certificates/{cert.code} 에서 언제든 진위를 확인할 수 있어요.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="size-24 rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
            <span className="text-[10px] text-ink-soft">진위 확인</span>
          </div>
        </footer>
      </article>
      <p className="text-center text-xs text-ink-soft print:hidden">인쇄하면 이 보증서만 깔끔하게 나와요 (브라우저 인쇄, PDF로 저장).</p>
    </Container>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </>
  );
}
