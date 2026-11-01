import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Textarea } from "@/components/ui/field";
import { answerInquiry } from "@/features/admin/actions";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { INQUIRY_TOPIC_LABEL } from "@/lib/domain/rules";
import { formatDateTime } from "@/lib/format";

const STATE = { new: "답변 대기", answered: "답변 완료", closed: "종료" } as const;

export default async function AdminInquiries() {
  const db = await adminDb();
  const rows = [...db.inquiries].sort(
    (a, b) => Number(b.state === "new") - Number(a.state === "new") || b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <>
      <AdminHeading title="문의" description="여기 쓴 답변은 문의한 사람이 ‘내 신청 현황’에서 바로 볼 수 있어요. 이메일로도 보내 주세요." />
      {rows.length === 0 && <p className="text-sm text-ink-soft">아직 문의가 없어요.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((q) => (
          <li key={q.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={q.state === "new" ? "warn" : "ok"}>{STATE[q.state]}</Badge>
              <Badge>{INQUIRY_TOPIC_LABEL[q.topic]}</Badge>
              <b className="text-base">{q.subject}</b>
              <span className="ml-auto font-mono text-xs text-ink-soft">{q.code}, {formatDateTime(q.createdAt)}</span>
            </div>
            <p className="text-ink-soft">{q.name}, {q.email}{q.phone && `, ${q.phone}`}{q.relatedCode && `, 관련 ${q.relatedCode}`}</p>
            <p className="rounded-sm bg-mist p-3 whitespace-pre-line">{q.message}</p>
            <form action={answerInquiry.bind(null, q.id)} className="flex flex-col gap-2">
              <Textarea name="answer" defaultValue={q.answer ?? ""} placeholder="답변" />
              <div className="flex items-center justify-between gap-2">
                <Checkbox name="close" label="문의 종료" />
                <Button type="submit" size="sm">{q.answer ? "답변 수정" : "답변 보내기"}</Button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
