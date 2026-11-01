"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Exhibition, School } from "@/lib/domain/types";
import { PlacePicker } from "@/features/places/place-picker";
import { saveExhibition, type FormState } from "./actions";

export function ExhibitionForm({ exhibition, schools }: { exhibition?: Exhibition; schools: School[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveExhibition.bind(null, exhibition?.id ?? null), null);
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5 md:grid-cols-2">
      {state?.error && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot md:col-span-2">{state.error}</p>}
      <Field label="전시명" required className="md:col-span-2"><Input name="title" defaultValue={exhibition?.title} /></Field>
      <Field label="학교">
        <Select name="schoolId" defaultValue={exhibition?.schoolId ?? ""}>
          <option value="">없음</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="학과"><Input name="department" defaultValue={exhibition?.department ?? ""} /></Field>
      <Field label="시작일" required><Input name="startDate" type="date" defaultValue={exhibition?.startDate} /></Field>
      <Field label="종료일" required><Input name="endDate" type="date" defaultValue={exhibition?.endDate} /></Field>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-semibold">장소</span>
        {exhibition && !exhibition.place && exhibition.venue && <span className="text-xs text-ink-soft">현재: {exhibition.venue}. 검색해서 고르면 지도 링크가 붙어요</span>}
        <PlacePicker
          name="venue"
          defaultPlace={exhibition?.place}
          defaultDetail={exhibition?.place ? exhibition.venue.replace(exhibition.place.name, "").trim() : exhibition?.venue}
        />
      </div>
      <Field label="관람 시간" hint="예: 월–금 10:00–20:00, 토 10:00–14:00"><Input name="hours" defaultValue={exhibition?.hours ?? ""} /></Field>
      <Field label="오프닝"><Input name="opening" defaultValue={exhibition?.opening ?? ""} placeholder="11.16 (월) 14:00" /></Field>
      <Field label="외부 링크" className="md:col-span-2"><Input name="link" defaultValue={exhibition?.link ?? ""} placeholder="https://" /></Field>
      <Field label="소개" className="md:col-span-2"><Textarea name="description" defaultValue={exhibition?.description} /></Field>
      <Button type="submit" size="lg" disabled={pending} className="md:col-span-2">{pending ? "저장하는 중…" : exhibition ? "변경 저장" : "전시 추가"}</Button>
    </ActionForm>
  );
}
