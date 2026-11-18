import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { WorkImage } from "@/features/catalog/work-image";
import { ConsultForm } from "@/features/rental/forms";
import { rentableWorks } from "@/features/rental/picks";
import { getCatalog, indexById } from "@/lib/data/catalog";
import { coverImage, rentalMonthly } from "@/lib/domain/rules";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "기업전용관",
  description: "매장, 사무실, 로비에 학생 작가의 원작을. 공간 렌탈, 기업 공간 전시, 기업 구매와 선물, 작가 섭외를 상담해요.",
};

const SERVICES = [
  { kind: "rental", title: "공간 렌탈", lines: ["3, 6, 12개월 단위", "철마다 다른 작품으로 교체", "설치와 회수까지 MAYO가"] },
  { kind: "exhibition", title: "기업 공간 전시", lines: ["로비, 쇼룸, 라운지에 작품 묶음 전시", "기획, 설치, QR 캡션 제작", "전시 중 판매도 연결"] },
  { kind: "purchase", title: "기업 구매, 선물", lines: ["임직원, 거래처, 개업 선물", "50만 원 이하 선물용 큐레이션", "작품 보증서 함께 발급"] },
  { kind: "commission", title: "커미션, 협업", lines: ["매장에 맞춘 주문 제작", "브랜드 협업 작품, 굿즈", "작가와 직접 조율"] },
  { kind: "hire", title: "작가 섭외, 채용", lines: ["졸업 작가 포트폴리오로 찾기", "디자이너, 작가 채용 연결", "강연, 워크숍 섭외"] },
] as const;

const STEPS = ["상담 신청", "작품 목록과 견적 제안", "계약과 세금계산서", "설치, QR 캡션", "교체와 회수"];

export default async function BusinessPage() {
  const catalog = await getCatalog();
  const artists = indexById(catalog.artists);
  const works = rentableWorks(catalog).slice(0, 8);
  return (
    <Container className="flex flex-col gap-16 py-10">
      <section className="bg-ink relative overflow-hidden rounded-3xl px-6 py-12 text-white sm:px-12 sm:py-16">
        <div aria-hidden className="bg-aurora absolute -top-24 -right-24 size-72 rounded-full opacity-50 blur-3xl" />
        <div className="relative flex max-w-2xl flex-col gap-5">
          <Eyebrow tone="dark">For Business</Eyebrow>
          <h1 className="text-3xl leading-tight font-bold sm:text-4xl">기업전용관</h1>
          <p className="leading-relaxed text-white/80">
            매장, 사무실, 로비에 학생 작가의 원작을 걸어요. 작품을 고르는 일부터 설치, 교체, 회수까지 MAYO가 맡고, 렌탈료와 판매 대금은 작가에게 돌아가요. 세금계산서를 발행해요.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="#consult">상담 신청하기</ButtonLink>
            <ButtonLink href="/rental" variant="secondary">렌탈 작품 보기</ButtonLink>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="border-b border-ink pb-3 text-xl font-bold">할 수 있는 일</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SERVICES.map((s) => (
            <li key={s.kind} className="glass flex flex-col gap-3 rounded-2xl p-5">
              <b className="text-lg">{s.title}</b>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
                {s.lines.map((l) => <li key={l} className="flex gap-2"><span aria-hidden className="bg-aurora mt-2 size-1.5 shrink-0 rounded-full" />{l}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="border-b border-ink pb-3 text-xl font-bold">진행 순서</h2>
        <ol className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl bg-white/70 p-4 text-sm font-semibold">
              <span className="text-violet tabular-nums">{String(i + 1).padStart(2, "0")}</span>{s}
            </li>
          ))}
        </ol>
      </section>

      {works.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
            <h2 className="text-xl font-bold">바로 렌탈할 수 있는 작품</h2>
            <Link href="/rental" className="text-sm font-semibold text-violet underline underline-offset-4">전체 보기</Link>
          </div>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-4">
            {works.map((w) => (
              <li key={w.id} className="min-w-0">
                <Link href={w.sample ? `/works/${w.id}` : `/rental/apply?for=business&work=${w.id}`} className="group flex flex-col gap-2">
                  <div className="aspect-[4/5] overflow-hidden rounded-[18px] bg-white/60">
                    <WorkImage src={coverImage(w)} alt={w.title} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </div>
                  <span className="truncate font-semibold">{w.title}</span>
                  <span className="-mt-1.5 flex justify-between text-[13px] text-ink-soft">
                    {artists.get(w.artistId)?.name}
                    <b className="text-ink">월 {formatPrice(rentalMonthly(w.price))}</b>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="consult" className="grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">상담 신청</h2>
          <p className="leading-relaxed text-ink-soft">공간과 예산, 일정을 알려 주시면 작품 목록과 견적을 이틀 안에 보내 드려요.</p>
          <dl className="flex flex-col gap-3 text-sm">
            <div><dt className="font-semibold">세금계산서</dt><dd className="text-ink-soft">렌탈료와 구매 대금 모두 발행해요. 사업자등록번호를 적어 주세요.</dd></div>
            <div><dt className="font-semibold">파손</dt><dd className="text-ink-soft">설치는 MAYO가 하고, 통상적인 사용으로 생긴 흠은 청구하지 않아요. 큰 파손은 보증금에서 수리비를 빼요.</dd></div>
            <div><dt className="font-semibold">운송</dt><dd className="text-ink-soft">큰 작품은 미술품 전문 운송으로 옮기고, 견적을 먼저 드려요.</dd></div>
          </dl>
        </div>
        <ConsultForm audience="business" defaultKind="rental" kinds={["rental", "exhibition", "purchase", "commission", "hire"]} />
      </section>
    </Container>
  );
}
