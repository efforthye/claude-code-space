"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { AvatarField } from "@/features/admin/avatar-field";
import { StoryEditor } from "@/features/admin/story-editor";
import type { Artist } from "@/lib/domain/types";
import { updateMyArtistProfile, type SellerFormState } from "./seller-actions";

/** 작가 페이지에 보이는 것들. 학교, 구분, 인증은 운영자가 바꾼다. */
export function ArtistProfileForm({ artist }: { artist: Artist }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(updateMyArtistProfile, undefined);
  return (
    <ActionForm action={action} className="glass grid gap-5 rounded-xl p-5 md:grid-cols-2">
      <AvatarField initial={artist.avatar} name={artist.name} endpoint="/api/media" />
      <Field label="작가 소개" className="md:col-span-2"><Textarea name="bio" defaultValue={artist.bio} maxLength={1000} /></Field>
      <Field label="인스타그램"><Input name="instagram" defaultValue={artist.instagram ?? ""} placeholder="@" /></Field>
      <Field label="포트폴리오 링크"><Input name="portfolioUrl" defaultValue={artist.portfolioUrl ?? ""} placeholder="https://" /></Field>
      <StoryEditor
        initial={artist.studio}
        name="studio"
        legend="작업실 소개 (작가 페이지에 보여요)"
        empty="작업실 사진, 쓰는 도구, 하루 작업 루틴처럼 작업 환경을 소개해 보세요."
        endpoint="/api/media"
      />
      {artist.deathYear == null && <Checkbox name="acceptsCommission" defaultChecked={artist.acceptsCommission} label="주문제작 문의를 받을게요" className="md:col-span-2" />}
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "저장하는 중…" : "작가 프로필 저장"}</Button>
        {state?.error && <p role="alert" className="text-sm font-medium text-dot">{state.error}</p>}
        {state === null && <p className="text-sm text-ink-soft">저장했어요. 작가 페이지에 바로 보여요.</p>}
      </div>
    </ActionForm>
  );
}
