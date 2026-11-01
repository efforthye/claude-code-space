"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { artShippingIds, KIND_LABEL, WORK_STATUS_LABEL, needsArtShipping } from "@/lib/domain/rules";
import { WORK_KINDS, type Artist, type Category, type Exhibition, type Work } from "@/lib/domain/types";
import { saveWork, type FormState } from "./actions";
import { StoryEditor } from "./story-editor";
import { MediaManager } from "./media-manager";

export function WorkForm({ work, artists, exhibitions, categories }: { work?: Work; artists: Artist[]; exhibitions: Exhibition[]; categories: Category[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWork.bind(null, work?.id ?? null), null);
  return (
    <ActionForm action={action} className="grid max-w-4xl gap-5 md:grid-cols-2">
      {state?.error && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot md:col-span-2">{state.error}</p>}
      <Field label="작품명" required><Input name="title" defaultValue={work?.title} /></Field>
      <Field label="작가" required hint="없으면 작가 메뉴에서 먼저 만들어 주세요">
        <Select name="artistId" defaultValue={work?.artistId ?? ""}>
          <option value="" disabled>작가 선택</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="매체" required>
        <Select name="medium" defaultValue={work?.medium ?? "painting"}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}{c.visible ? "" : " (숨김)"}</option>)}
        </Select>
      </Field>
      <Field label="작품 구분" required>
        <Select name="kind" defaultValue={work?.kind ?? "graduation"}>
          {WORK_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
      </Field>
      <Field label="출품 전시">
        <Select name="exhibitionId" defaultValue={work?.exhibitionId ?? ""}>
          <option value="">없음</option>
          {exhibitions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </Select>
      </Field>
      <Field label="재료" required hint="예: 캔버스에 아크릴"><Input name="materials" defaultValue={work?.materials} /></Field>
      <div className="grid grid-cols-3 gap-2 md:col-span-2">
        <Field label="가로 cm" required><Input name="widthCm" inputMode="decimal" defaultValue={work?.widthCm} /></Field>
        <Field label="세로 cm" required><Input name="heightCm" inputMode="decimal" defaultValue={work?.heightCm} /></Field>
        <Field label="깊이 cm"><Input name="depthCm" inputMode="decimal" defaultValue={work?.depthCm ?? ""} /></Field>
      </div>
      <Field label="무게 kg" hint="100cm나 20kg 이상, 조각과 가구는 전문 운송으로 분류돼요"><Input name="weightKg" inputMode="decimal" defaultValue={work?.weightKg ?? ""} /></Field>
      <Field label="제작 연도" required><Input name="year" inputMode="numeric" defaultValue={work?.year ?? new Date().getFullYear()} /></Field>
      <Field label="에디션 번호" hint="판화와 사진만. 예: 3/10"><Input name="edition" defaultValue={work?.edition ?? ""} /></Field>
      <Field label="가격 (원)" required><Input name="price" inputMode="numeric" defaultValue={work?.price} /></Field>
      <Field label="판매 상태" required hint="주문이 들어오면 자동으로 예약 중 → 판매 완료로 바뀌어요">
        <Select name="status" defaultValue={work?.status ?? "available"}>
          {(["available", "reserved", "sold", "hidden"] as const).map((st) => <option key={st} value={st}>{WORK_STATUS_LABEL[st]}</option>)}
        </Select>
      </Field>
      <Field label="작품 설명" className="md:col-span-2"><Textarea name="description" defaultValue={work?.description} /></Field>

      <MediaManager initial={work?.media ?? []} />
      <StoryEditor initial={work?.story ?? []} />

      <fieldset className="grid gap-4 rounded-lg border border-ink/10 p-4 md:col-span-2 md:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">작가가 아닌 사람이 파는 작품 (작고 작가, 2차 거래)</legend>
        <Field label="판매자 표시" hint="비워 두면 작가 본인 판매. 예: 작가 유족, 개인 소장자"><Input name="consignor" defaultValue={work?.consignor ?? ""} /></Field>
        <Field label="감정, 보증서" hint="감정 기관과 번호. 사본은 운영자가 확인"><Input name="appraisal" defaultValue={work?.appraisal ?? ""} /></Field>
        <Field label="소장 이력" className="md:col-span-2" hint="누가 언제부터 가지고 있었는지"><Textarea name="provenance" defaultValue={work?.provenance ?? ""} /></Field>
      </fieldset>

      <div className="flex flex-col gap-2 md:col-span-2">
        <Checkbox name="allowsPickup" defaultChecked={work?.allowsPickup ?? true} label="직거래(직접 수령) 허용" />
        <Checkbox name="featured" defaultChecked={work?.featured} label="홈 대표 작품으로 노출" />
        <Checkbox name="operatorOwned" defaultChecked={work?.operatorOwned} label="운영자 본인이나 친족 소유 작품 (작품 페이지에 고지 문구가 붙어요)" />
      </div>
      {work && needsArtShipping(work, artShippingIds(categories)) && <p className="text-xs text-warn md:col-span-2">이 작품은 현재 ‘미술품 전문 운송’ 대상으로 분류돼요.</p>}
      <Button type="submit" size="lg" disabled={pending} className="md:col-span-2">{pending ? "저장하는 중…" : work ? "변경 저장" : "작품 등록"}</Button>
    </ActionForm>
  );
}
