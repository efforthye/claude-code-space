"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { AvatarField } from "@/features/admin/avatar-field";
import { ImageField } from "@/features/admin/image-field";
import { updateMyProfile, type SellerFormState } from "./seller-actions";
import type { Me } from "./session";

/** 마이페이지 프로필: 배경 이미지, 프로필 사진, 이름, 한 줄 소개, 연락처 */
export function ProfileEditor({ me }: { me: Me }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(updateMyProfile, undefined);
  return (
    <ActionForm action={action} className="glass grid gap-5 rounded-xl p-5 sm:grid-cols-2">
      <ImageField name="cover" label="배경 이미지" initial={me.cover} endpoint="/api/media" className="sm:col-span-2" />
      <AvatarField initial={me.avatar} name={me.name} endpoint="/api/media" />
      <Field label="이름"><Input name="name" defaultValue={me.name} autoComplete="name" /></Field>
      <Field label="휴대폰"><Input name="phone" defaultValue={me.phone ?? ""} type="tel" autoComplete="tel" /></Field>
      <Field label="한 줄 소개" hint="160자까지" className="sm:col-span-2"><Textarea name="bio" defaultValue={me.bio ?? ""} maxLength={160} className="min-h-20" /></Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "저장하는 중…" : "프로필 저장"}</Button>
        {state?.error && <p role="alert" className="text-sm font-medium text-dot">{state.error}</p>}
        {state === null && <p className="text-sm text-ink-soft">저장했어요.</p>}
      </div>
    </ActionForm>
  );
}
