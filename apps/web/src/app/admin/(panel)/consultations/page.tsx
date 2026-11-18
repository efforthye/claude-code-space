import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { answerConsultation } from "@/features/admin/rental-actions";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { CONSULT_KIND_LABEL, CONSULT_STATE_LABEL } from "@/lib/domain/rules";
import { formatDateTime } from "@/lib/format";

export default async function AdminConsultations() {
  const db = await adminDb();
  const rows = [...db.consultations].sort((a, b) => Number(b.state === "new") - Number(a.state === "new") || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <AdminHeading title="기업, 추천 상담" description="기업전용관 상담과 개인 작품 추천 요청이에요. 여기 쓴 제안은 신청한 사람의 마이페이지와 메일로 가요. 렌탈 견적은 렌탈 신청 링크(/rental/apply?for=business&work=…)로 보내면 바로 신청할 수 있어요." />
      {rows.length === 0 && <p className="text-sm text-ink-soft">아직 상담 신청이 없어요.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={c.state === "new" ? "warn" : "ok"}>{CONSULT_STATE_LABEL[c.state]}</Badge>
              <Badge>{c.audience === "business" ? "기업" : "개인"}</Badge>
              <Badge>{CONSULT_KIND_LABEL[c.kind]}</Badge>
              <b className="text-base">{c.company ? `${c.company}, ` : ""}{c.name}</b>
              <span className="ml-auto font-mono text-xs text-ink-soft">{c.code}, {formatDateTime(c.createdAt)}</span>
            </div>
            <p className="text-ink-soft">{c.email}, {c.phone}{c.bizNumber && `, 사업자 ${c.bizNumber}`}</p>
            <dl className="grid grid-cols-[5rem_1fr] gap-y-1">
              {c.space && (<><dt className="text-ink-soft">공간</dt><dd>{c.space}</dd></>)}
              {c.budget && (<><dt className="text-ink-soft">예산</dt><dd>{c.budget}</dd></>)}
              {c.period && (<><dt className="text-ink-soft">일정</dt><dd>{c.period}</dd></>)}
              {c.mood && (<><dt className="text-ink-soft">분위기</dt><dd>{c.mood}</dd></>)}
              {c.workIds.length > 0 && (<><dt className="text-ink-soft">관심 작품</dt><dd>{c.workIds.map((id) => <Link key={id} href={`/works/${id}`} className="mr-2 underline">{db.works.find((w) => w.id === id)?.title ?? id}</Link>)}</dd></>)}
            </dl>
            {c.message && <p className="rounded-sm bg-mist p-3 whitespace-pre-line">{c.message}</p>}
            <form action={answerConsultation.bind(null, c.id)} className="flex flex-col gap-2">
              <Textarea name="answer" defaultValue={c.answer ?? ""} placeholder="제안 (작품 목록, 견적, 일정)" />
              <div className="flex items-center justify-end gap-2">
                <Select name="state" defaultValue="" className="h-8 w-40">
                  <option value="">상태 자동</option>
                  {Object.entries(CONSULT_STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Button type="submit" size="sm">{c.answer ? "제안 수정" : "제안 보내기"}</Button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
