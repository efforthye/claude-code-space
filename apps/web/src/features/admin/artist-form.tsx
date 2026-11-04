"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { VERIFY_LABEL } from "@/lib/domain/rules";
import type { Artist, ArtistGroup, School, VerifyMethod } from "@/lib/domain/types";
import { saveArtist, type FormState } from "./actions";
import { AvatarField } from "./avatar-field";
import { StoryEditor } from "./story-editor";

export function ArtistForm({ artist, schools, groups, memberEmail }: { artist?: Artist; schools: School[]; groups: ArtistGroup[]; memberEmail?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveArtist.bind(null, artist?.id ?? null), null);
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5 md:grid-cols-2">
      {state?.error && <p className="rounded-sm bg-dot/10 p-3 text-sm text-dot md:col-span-2">{state.error}</p>}
      <AvatarField initial={artist?.avatar ?? null} name={artist?.name ?? ""} />
      <Field label="작가명" required hint="사이트에 보이는 이름, 예명 가능"><Input name="name" defaultValue={artist?.name} /></Field>
      <Field label="본명" hint="관리자만 봐요. 정산, 인증용"><Input name="realName" defaultValue={artist?.realName ?? ""} /></Field>
      <Field label="연결된 회원 이메일" hint="이 회원이 마이페이지 판매 탭에서 작품과 프로필을 관리해요"><Input name="memberEmail" type="email" defaultValue={memberEmail ?? ""} /></Field>
      <Field label="구분" required hint="목록은 '작가 구분' 메뉴에서 관리">
        <Select name="status" defaultValue={artist?.status ?? "student"}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
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
      <Field label="출생 연도"><Input name="birthYear" inputMode="numeric" defaultValue={artist?.birthYear ?? ""} placeholder="1938" /></Field>
      <Field label="작고 연도" hint="넣으면 작고 작가로 표시되고, 주문제작은 꺼져요"><Input name="deathYear" inputMode="numeric" defaultValue={artist?.deathYear ?? ""} /></Field>
      <Field label="작품, 저작권 관리" hint="작고 작가만. 예: 작가 유족, OO재단" className="md:col-span-2"><Input name="estate" defaultValue={artist?.estate ?? ""} /></Field>
      <Field label="작가 소개" className="md:col-span-2"><Textarea name="bio" defaultValue={artist?.bio} /></Field>
      <StoryEditor
        initial={artist?.studio ?? []}
        name="studio"
        legend="작업실 소개 (선택, 작가 페이지에 보여요)"
        empty="작업실 사진, 쓰는 도구, 하루 작업 루틴처럼 작업 환경을 소개해 보세요."
      />
      <Checkbox name="acceptsCommission" defaultChecked={artist?.acceptsCommission} label="주문제작 가능" className="md:col-span-2" />
      <Button type="submit" size="lg" disabled={pending} className="md:col-span-2">{pending ? "저장하는 중…" : artist ? "변경 저장" : "작가 추가"}</Button>
    </ActionForm>
  );
}
