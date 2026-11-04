import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { ArtistProfileForm } from "@/features/account/artist-profile-form";
import { myArtist } from "@/features/account/seller";
import { requireUser } from "@/features/account/session";
import { AccountShell, Section } from "@/features/account/shell";

export const metadata: Metadata = { title: "작가 프로필", robots: { index: false } };

export default function ArtistProfilePage() {
  return (
    <Suspense fallback={<Container className="py-20 text-ink-soft">불러오는 중…</Container>}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const me = await requireUser("/account/sell/profile");
  const artist = await myArtist(me.id);
  if (!artist) redirect("/account/sell");
  return (
    <AccountShell me={me} mode="sell">
      <Section title="작가 프로필">
        <p className="text-sm text-ink-soft">작가 페이지에 보이는 사진, 소개, 작업실을 꾸밀 수 있어요. 학교, 구분, 학교 인증은 운영자가 확인해서 바꿔요.</p>
        <ArtistProfileForm artist={artist} />
      </Section>
    </AccountShell>
  );
}
