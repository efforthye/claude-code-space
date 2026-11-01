import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { RedDot } from "@/components/ui/red-dot";
import { VerificationCard } from "@/components/ui/verified-badge";
import { AddToCart } from "@/features/cart/add-to-cart";
import { WorkCard } from "@/features/catalog/work-card";
import { MediaGallery } from "@/features/catalog/media-gallery";
import { getCatalog, indexById } from "@/lib/data/catalog";
import { artShippingIds, groupLabel, isDeceased, lifespan, categoryLabel, coverImage, KIND_LABEL, needsArtShipping, SHIPPING_LABEL, shippingOptions } from "@/lib/domain/rules";
import { formatPrice, formatSize } from "@/lib/format";
import { MetaLine } from "@/components/ui/meta-line";

export default function WorkPage(props: PageProps<"/works/[id]">) {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">작품을 불러오는 중…</Container>}>
      <WorkDetail params={props.params} />
    </Suspense>
  );
}

async function WorkDetail({ params }: { params: PageProps<"/works/[id]">["params"] }) {
  const { id } = await params;
  const { works, artists, schools, exhibitions, categories, artistGroups } = await getCatalog();
  const artSet = artShippingIds(categories);
  const work = works.find((w) => w.id === id);
  if (!work) notFound();

  const artist = indexById(artists).get(work.artistId);
  const school = artist?.schoolId ? indexById(schools).get(artist.schoolId) : undefined;
  const exhibition = work.exhibitionId ? indexById(exhibitions).get(work.exhibitionId) : undefined;
  const options = shippingOptions(work, artSet);
  const more = works.filter((w) => w.artistId === work.artistId && w.id !== work.id).slice(0, 4);

  return (
    <Container className="flex flex-col gap-16 py-10">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <MediaGallery media={work.media} title={work.title} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 border-l-4 border-ink pl-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{KIND_LABEL[work.kind]}</Badge>
              <Badge>{categoryLabel(categories, work.medium)}</Badge>
            </div>
            <h1 className="text-2xl font-bold">「{work.title}」</h1>
            {artist && (
              <Link href={`/artists/${artist.id}`} className="font-semibold underline-offset-4 hover:underline">
                {artist.name}
                <span className="ml-2 text-sm font-normal text-ink-soft">
                  <MetaLine>
                    {lifespan(artist)}
                    {school?.name}
                    {artist.department}
                    {groupLabel(artistGroups, artist.status)}
                  </MetaLine>
                </span>
              </Link>
            )}
          </div>
          {artist && !isDeceased(artist) && (
            <VerificationCard
              method={artist.verifiedBy}
              verifiedAt={artist.verifiedAt}
              schoolName={school?.name}
              department={artist.department}
              statusLabel={groupLabel(artistGroups, artist.status)}
            />
          )}

          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-ink-soft">재료</dt><dd>{work.materials}</dd>
            <dt className="text-ink-soft">크기</dt><dd>{formatSize(work.widthCm, work.heightCm, work.depthCm)}</dd>
            {work.weightKg != null && (<><dt className="text-ink-soft">무게</dt><dd>{work.weightKg}kg</dd></>)}
            <dt className="text-ink-soft">제작</dt><dd>{work.year}년</dd>
            {work.edition && (<><dt className="text-ink-soft">에디션</dt><dd>{work.edition}</dd></>)}
            {work.consignor && (<><dt className="text-ink-soft">판매자</dt><dd>{work.consignor}</dd></>)}
            {work.provenance && (<><dt className="text-ink-soft">소장 이력</dt><dd className="whitespace-pre-line">{work.provenance}</dd></>)}
            {work.appraisal && (<><dt className="text-ink-soft">감정, 보증</dt><dd>{work.appraisal}</dd></>)}
            {exhibition && (
              <><dt className="text-ink-soft">출품 전시</dt><dd><Link href={`/exhibitions/${exhibition.id}`} className="underline underline-offset-4">{exhibition.title}</Link></dd></>
            )}
            <dt className="text-ink-soft">받는 방법</dt>
            <dd>{options.map((o) => SHIPPING_LABEL[o]).join(" / ")}</dd>
          </dl>

          <div className="flex flex-col gap-3 border-y border-line py-5">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{formatPrice(work.price)}</span>
              <RedDot status={work.status} />
            </div>
            {needsArtShipping(work, artSet) && (
              <p className="rounded-sm bg-warn-soft p-3 text-xs text-warn">
                크기와 무게 때문에 미술품 전문 운송 대상입니다. 주문 신청 후 운송 견적을 먼저 안내드리고, 동의하신 뒤에 운송비를
                받습니다.
              </p>
            )}
            <AddToCart workId={work.id} status={work.status} defaultShipping={options[0]} cover={coverImage(work)} />
            <p className="text-xs text-ink-soft">로그인 없이 담고 주문 신청할 수 있어요. 결제는 무통장 입금으로 진행됩니다.</p>
          </div>

          {(work.consignor || (artist && isDeceased(artist))) && (
            <p className="glass rounded-md p-3 text-xs leading-relaxed">
              이 작품은 작가 본인이 아니라 {work.consignor ?? artist?.estate ?? "소장자"} 측에서 판매합니다. MAYO는 거래를 중개하며, 진위와 소장 이력에
              대한 1차 책임은 판매자에게 있습니다. 감정서나 보증서가 필요하면 주문 전에 문의해 주세요.
            </p>
          )}

          {work.operatorOwned && (
            <p className="rounded-sm border border-clay bg-clay-soft p-3 text-xs text-ink">
              고지: 이 작품은 MAYO 운영자 본인 또는 친족이 소유한 작품입니다.
            </p>
          )}

          {work.description && <p className="leading-relaxed whitespace-pre-line">{work.description}</p>}

          <details className="text-xs text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">청약철회(반품) 안내</summary>
            <p className="mt-2 leading-relaxed">
              작품을 받은 날부터 7일 이내에 청약을 철회할 수 있습니다. 받은 작품이 표시나 광고 내용과 다르거나 계약과 다르게
              이행된 경우에는 받은 날부터 3개월 이내, 그 사실을 안 날(또는 알 수 있었던 날)부터 30일 이내에 철회할 수 있습니다.
              주문제작 작품은 결제 전에 별도로 안내하고 동의받은 경우에 한해 철회가 제한될 수 있습니다.
            </p>
          </details>
        </div>
      </div>

      {work.story.length > 0 && (
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-8" aria-labelledby="story-heading">
          <div className="flex flex-col gap-1">
            <span className="font-display text-sm text-violet italic">The story</span>
            <h2 id="story-heading" className="text-2xl font-bold">작품 이야기</h2>
          </div>
          {work.story.map((b, i) =>
            b.kind === "text" ? (
              <p key={i} className="text-[17px] leading-[1.85] whitespace-pre-line">{b.text}</p>
            ) : (
              <figure key={i} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.caption ?? `${work.title} 이야기 사진 ${i + 1}`} loading="lazy" className="w-full rounded-lg" />
                {b.caption && <figcaption className="text-sm text-ink-soft">{b.caption}</figcaption>}
              </figure>
            ),
          )}
        </section>
      )}

      {more.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="border-b border-ink pb-3 text-xl font-bold">{artist?.name}의 다른 작품</h2>
          <div className="columns-2 gap-6 md:columns-4">
            {more.map((w) => <WorkCard key={w.id} work={w} artist={artist} school={school} mediumLabel={categoryLabel(categories, w.medium)} />)}
          </div>
        </section>
      )}
    </Container>
  );
}
