import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = { title: "The First Collection" };

const TRACKS = [
  { who: "작가", name: "MAYO 퍼스트 컬렉션", how: "작품 등록 → 인스타그램에 #mayo첫컬렉션 + @mayo.im 태그 → 응모", reward: "심사로 3점을 골라 MAYO가 실제로 구매해요 (작품당 최대 30만 원, 가격 협의). 참여상 화방 상품권 1만 원 20명, 응모작 전원 무료 촬영." },
  { who: "관람객", name: "갖고 싶은 작품", how: "졸전에서 고른 작품을 스토리에 올리고 @mayo.im 태그 → 캡처로 응모", reward: "추첨 2명에게 고른 작품 작가의 엽서와 외식 상품권 5만 원." },
  { who: "작가 미션", name: "하면 무조건 커피", how: "① 내 작품 등록 ② 내 스토리 쓰기 ③ 다른 작가 글에 댓글", reward: "세 가지를 모두 하면 선착순 100명 아메리카노 쿠폰, 그중 3명 화방 상품권 5만 원." },
];

export default function FirstCollectionPage() {
  return (
    <>
      <Container className="pt-6">
      <section className="relative overflow-hidden rounded-lg" style={{ background: "linear-gradient(110deg, #1d1530 0%, #3a1f7a 45%, #ff5fa2 85%, #ff9d4d 100%)" }}>
        <span aria-hidden className="absolute -top-24 -right-20 size-96 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 px-7 py-16 text-white sm:px-12 sm:py-20">
          <Eyebrow tone="dark">Event · Graduation season 2026</Eyebrow>
          <h1 className="font-display text-6xl leading-[0.95] sm:text-8xl">
            The First
            <br />
            <i>Collection</i>
          </h1>
          <p className="max-w-xl text-lg text-white/90">졸업작품 3점, MAYO가 첫 번째 소장가가 될게요. 경품 대신 작품을 사는 이벤트예요.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/join" size="lg" variant="secondary">작가로 응모하기</ButtonLink>
          </div>
        </div>
      </section>
      </Container>

      <Container className="flex flex-col gap-10 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {TRACKS.map((t) => (
            <article key={t.name} className="glass flex flex-col gap-3 rounded-lg p-6">
              <span className="w-fit rounded-full bg-violet px-2.5 py-0.5 text-xs font-semibold text-white">{t.who}</span>
              <h2 className="text-xl font-bold">{t.name}</h2>
              <p className="text-sm leading-relaxed"><b>참여</b> · {t.how}</p>
              <p className="text-sm leading-relaxed text-ink-soft"><b className="text-ink">보상</b> · {t.reward}</p>
            </article>
          ))}
        </div>

        <section className="glass flex flex-col gap-3 rounded-lg p-6 text-sm leading-relaxed">
          <h2 className="text-lg font-bold">대표작이 예산보다 비싸다면</h2>
          <p>원래 가격표는 그대로 두고, 선정된 작가가 방식을 골라요: 응모작을 예산 안에서 판매하거나, 같은 작업의 소품·에디션을 판매하거나, 작품은 팔지 않고 지원금과 인터뷰 영상을 받을 수 있어요.</p>
          <p>응모해도 일반 판매는 그대로 계속돼요. 다른 컬렉터가 먼저 사면 그 판매가 우선이에요.</p>
        </section>

        <section className="flex flex-col gap-2 text-xs leading-relaxed text-ink-soft">
          <p>이 이벤트는 인스타그램이 후원·보증·관리하지 않습니다. 응모 기간·발표일은 공지 예정이에요.</p>
          <p>당첨자 연락처는 경품 발송·구매 협의 후 파기합니다. 5만 원이 넘는 경품의 제세공과금은 MAYO가 부담해요.</p>
        </section>
      </Container>
    </>
  );
}
