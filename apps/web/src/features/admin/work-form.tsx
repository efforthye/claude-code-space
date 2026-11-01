"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { WorkImage } from "@/features/catalog/work-image";
import { KIND_LABEL, MEDIUM_LABEL, WORK_STATUS_LABEL, needsArtShipping } from "@/lib/domain/rules";
import { MEDIA, WORK_KINDS, type Artist, type Exhibition, type Work } from "@/lib/domain/types";
import { saveWork, type FormState } from "./actions";

export function WorkForm({ work, artists, exhibitions }: { work?: Work; artists: Artist[]; exhibitions: Exhibition[] }) {
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
          {MEDIA.map((m) => <option key={m} value={m}>{MEDIUM_LABEL[m]}</option>)}
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
      <Field label="무게 kg" hint="100cm·20kg 이상, 조각·가구는 전문 운송으로 분류돼요"><Input name="weightKg" inputMode="decimal" defaultValue={work?.weightKg ?? ""} /></Field>
      <Field label="제작 연도" required><Input name="year" inputMode="numeric" defaultValue={work?.year ?? new Date().getFullYear()} /></Field>
      <Field label="에디션 번호" hint="판화·사진만. 예: 3/10"><Input name="edition" defaultValue={work?.edition ?? ""} /></Field>
      <Field label="가격 (원)" required><Input name="price" inputMode="numeric" defaultValue={work?.price} /></Field>
      <Field label="판매 상태" required hint="주문이 들어오면 자동으로 예약 중 → 판매 완료로 바뀌어요">
        <Select name="status" defaultValue={work?.status ?? "available"}>
          {(["available", "reserved", "sold", "hidden"] as const).map((st) => <option key={st} value={st}>{WORK_STATUS_LABEL[st]}</option>)}
        </Select>
      </Field>
      <Field label="작품 설명" className="md:col-span-2"><Textarea name="description" defaultValue={work?.description} /></Field>

      <fieldset className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 md:col-span-2">
        <legend className="px-1 text-sm font-semibold">사진 (첫 장이 대표 사진)</legend>
        {work && work.images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {work.images.map((src, i) => (
              <label key={src + i} className="flex w-24 flex-col items-center gap-1 text-xs">
                <WorkImage src={src} alt="" className="size-24 border border-line" />
                <span className="flex items-center gap-1"><input type="checkbox" name="keepImage" value={src} defaultChecked className="accent-violet" /> 유지</span>
              </label>
            ))}
          </div>
        )}
        <Field label="사진 올리기" hint="JPG·PNG·WEBP, 장당 10MB 이하 · 실물 색에 맞춰 보정한 사진을 올려 주세요">
          <Input name="newImages" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="pt-2" />
        </Field>
        <Field label="또는 이미지 주소" hint="https:// 로 시작"><Input name="imageUrl" placeholder="https://" /></Field>
      </fieldset>

      <div className="flex flex-col gap-2 md:col-span-2">
        <Checkbox name="allowsPickup" defaultChecked={work?.allowsPickup ?? true} label="직거래(직접 수령) 허용" />
        <Checkbox name="featured" defaultChecked={work?.featured} label="홈 대표 작품으로 노출" />
        <Checkbox name="operatorOwned" defaultChecked={work?.operatorOwned} label="운영자 본인·친족 소유 작품 (작품 페이지에 고지 문구가 붙어요)" />
      </div>
      {work && needsArtShipping(work) && <p className="text-xs text-warn md:col-span-2">이 작품은 현재 ‘미술품 전문 운송’ 대상으로 분류돼요.</p>}
      <Button type="submit" size="lg" disabled={pending} className="md:col-span-2">{pending ? "저장하는 중…" : work ? "변경 저장" : "작품 등록"}</Button>
    </ActionForm>
  );
}
