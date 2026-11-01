"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ARTIST_STATUS_LABEL, VERIFY_LABEL } from "@/lib/domain/rules";
import type { Artist, ArtistStatus, School, VerifyMethod } from "@/lib/domain/types";
import { saveArtist, type FormState } from "./actions";

export function ArtistForm({ artist, schools }: { artist?: Artist; schools: School[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveArtist.bind(null, artist?.id ?? null), null);
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5 md:grid-cols-2">
      {state?.error && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot md:col-span-2">{state.error}</p>}
      <Field label="작가명" required hint="예명 가능"><Input name="name" defaultValue={artist?.name} /></Field>
      <Field label="구분" required>
        <Select name="status" defaultValue={artist?.status ?? "student"}>
          {(Object.keys(ARTIST_STATUS_LABEL) as ArtistStatus[]).map((k) => <option key={k} value={k}>{ARTIST_STATUS_LABEL[k]}</option>)}
        </Select>
      </Field>
      <Field label="학교" hint="목록에 없으면 학교 메뉴에서 추가">
        <Select name="schoolId" defaultValue={artist?.schoolId ?? ""}>
          <option value="">없음</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="학과"><Input name="department" defaultValue={artist?.department ?? ""} /></Field>
      <Field label="졸업(예정) 연도"><Input name="gradYear" inputMode="numeric" defaultValue={artist?.gradYear ?? ""} /></Field>
      <Field label="학교 인증" hint="서류를 직접 확인한 뒤에만 고르고, 확인한 서류는 바로 파기하세요">
        <Select name="verifiedBy" defaultValue={artist?.verifiedBy ?? ""}>
          <option value="">미인증</option>
          {(Object.keys(VERIFY_LABEL) as VerifyMethod[]).map((k) => <option key={k} value={k}>{VERIFY_LABEL[k]}로 확인</option>)}
        </Select>
      </Field>
      <Field label="인스타그램"><Input name="instagram" defaultValue={artist?.instagram ?? ""} /></Field>
      <Field label="포트폴리오 링크"><Input name="portfolioUrl" defaultValue={artist?.portfolioUrl ?? ""} placeholder="https://" /></Field>
      <Field label="작가 소개" className="md:col-span-2"><Textarea name="bio" defaultValue={artist?.bio} /></Field>
      <Checkbox name="acceptsCommission" defaultChecked={artist?.acceptsCommission} label="주문제작 가능" className="md:col-span-2" />
      <Button type="submit" size="lg" disabled={pending} className="md:col-span-2">{pending ? "저장하는 중…" : artist ? "변경 저장" : "작가 추가"}</Button>
    </ActionForm>
  );
}
