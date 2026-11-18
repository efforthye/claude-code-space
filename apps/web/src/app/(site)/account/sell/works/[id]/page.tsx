import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { MyWorkForm } from "@/features/account/my-work-form";
import { myArtist, myWork } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";
import { getCatalog } from "@/lib/data/catalog";
import { store } from "@/lib/data/store";
import Link from "next/link";
import { AuctionRequestForm } from "@/features/auction/request-form";

export const metadata: Metadata = { title: "작품 고치기", robots: { index: false } };

export default function Page(props: PageProps<"/account/sell/works/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Form params={props.params} />
    </Suspense>
  );
}

async function Form({ params }: { params: PageProps<"/account/sell/works/[id]">["params"] }) {
  const me = await requireUser("/account/sell/works");
  const artist = await myArtist(me.id);
  if (!artist) redirect("/account/sell");
  const { categories } = await getCatalog();
  const { id } = await params;
  const work = await myWork(artist.id, id);
  if (!work) notFound();
  if (work.status === "reserved" || work.status === "sold") redirect("/account/sell/works");
  const request = (await store.read()).auctions.find((a) => a.workId === work.id && a.state === "requested");
  return (
    <AccountShell me={me} mode="sell">
      <Section title="작품 고치기">
        <p className="text-sm text-ink-soft">고친 내용은 바로 반영돼요.</p>
        <MyWorkForm work={work} categories={categories.filter((c) => c.visible)} />
      </Section>
      <Section title="졸전 경매로 내기">
        <p className="text-sm text-ink-soft">
          전시 기간 동안 입찰을 받고 마지막 날 저녁에 마감해요. 입찰이 없으면 지금 가격으로 계속 팔아요. 시작가와 입찰 단위는 작가님이 정하고, 일정은 운영자가 전시에 맞춰 정해요.
        </p>
        {request ? (
          <p className="text-sm">경매 신청을 받았어요. 시작가 {request.startPrice.toLocaleString("ko-KR")}원, 운영자가 일정을 정하면 열려요.</p>
        ) : work.auctionId ? (
          <p className="text-sm">경매에 올라가 있어요. <Link href={`/works/${work.id}`} className="underline underline-offset-4">경매 화면 보기</Link></p>
        ) : work.status === "available" && !work.pendingReview ? (
          <AuctionRequestForm workId={work.id} price={work.price} />
        ) : (
          <p className="text-sm text-ink-soft">검수를 마치고 판매 중인 작품만 경매로 낼 수 있어요.</p>
        )}
      </Section>
    </AccountShell>
  );
}
