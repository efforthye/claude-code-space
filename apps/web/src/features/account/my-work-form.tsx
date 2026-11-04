"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { MediaManager } from "@/features/admin/media-manager";
import { StoryEditor } from "@/features/admin/story-editor";
import { KIND_LABEL } from "@/lib/domain/rules";
import { WORK_KINDS, type Category, type Work } from "@/lib/domain/types";
import { saveMyWork, type SellerFormState } from "./seller-actions";

/** 작가가 직접 올리는 작품. 새 작품은 운영자 검수 뒤 공개된다. */
export function MyWorkForm({ work, categories }: { work?: Work; categories: Category[] }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(saveMyWork.bind(null, work?.id ?? null), undefined);
  return (
    <ActionForm action={action} className="glass grid gap-5 rounded-xl p-5 md:grid-cols-2">
      {state?.error && <p role="alert" className="rounded-lg bg-dot/10 p-3 text-sm text-dot md:col-span-2">{state.error}</p>}
      <Field label="작품명" required className="md:col-span-2"><Input name="title" defaultValue={work?.title} /></Field>
      <Field label="분류" required>
        <Select name="medium" defaultValue={work?.medium ?? categories[0]?.id}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </Field>
      <Field label="작품 구분" required>
        <Select name="kind" defaultValue={work?.kind ?? "graduation"}>
          {WORK_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
      </Field>
      <Field label="재료" required hint="예: 캔버스에 아크릴" className="md:col-span-2"><Input name="materials" defaultValue={work?.materials} /></Field>
      <Field label="가로 (cm)" required><Input name="widthCm" inputMode="decimal" defaultValue={work?.widthCm} /></Field>
      <Field label="세로 (cm)" required><Input name="heightCm" inputMode="decimal" defaultValue={work?.heightCm} /></Field>
      <Field label="깊이 (cm)" hint="입체 작품만"><Input name="depthCm" inputMode="decimal" defaultValue={work?.depthCm ?? ""} /></Field>
      <Field label="무게 (kg)" hint="운송 견적에 써요"><Input name="weightKg" inputMode="decimal" defaultValue={work?.weightKg ?? ""} /></Field>
      <Field label="제작 연도" required><Input name="year" inputMode="numeric" defaultValue={work?.year ?? new Date().getFullYear()} /></Field>
      <Field label="에디션" hint="판화, 사진만. 예: 3/10"><Input name="edition" defaultValue={work?.edition ?? ""} /></Field>
      <Field label="판매 가격 (원)" required hint="이번 시즌 수수료 0%"><Input name="price" inputMode="numeric" defaultValue={work?.price} /></Field>
      <Checkbox name="allowsPickup" defaultChecked={work?.allowsPickup ?? true} label="직접 수령(직거래)도 받을게요" className="self-end pb-2" />
      <Field label="작품 설명" className="md:col-span-2"><Textarea name="description" defaultValue={work?.description} /></Field>
      <MediaManager initial={work?.media ?? []} endpoint="/api/media" imagesOnly />
      <StoryEditor initial={work?.story ?? []} endpoint="/api/media" />
      <Button type="submit" size="lg" disabled={pending} className="md:col-span-2">
        {pending ? "저장하는 중…" : work ? "변경 저장" : "검수 요청하고 등록"}
      </Button>
    </ActionForm>
  );
}
