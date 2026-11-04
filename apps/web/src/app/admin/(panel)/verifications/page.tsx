import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { decideVerification } from "@/features/admin/actions";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { VERIFY_LABEL } from "@/lib/domain/rules";
import { formatDateTime } from "@/lib/format";

export default async function AdminVerifications() {
  const db = await adminDb();
  const list = [...db.verifications].sort((a, b) => Number(b.state === "new") - Number(a.state === "new") || b.createdAt.localeCompare(a.createdAt));
  const userOf = new Map(db.users.map((u) => [u.id, u]));
  return (
    <>
      <AdminHeading
        title="학교 인증 심사"
        description="회원이 보낸 학교 인증 요청이에요. 학생증 사진은 승인하거나 반려하는 즉시 지워져요. 학교 이메일은 그 주소로 확인 메일을 보내 답장을 받은 뒤 승인하세요."
      />
      <ul className="flex flex-col gap-3">
        {list.map((v) => {
          const u = userOf.get(v.userId);
          return (
            <li key={v.id} className="glass flex flex-col gap-3 rounded-xl p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{u?.name ?? "탈퇴한 회원"} <span className="font-normal text-ink-soft">{u?.email}</span></span>
                <Badge tone={v.state === "new" ? "warn" : v.state === "approved" ? "ok" : "neutral"}>{v.state === "new" ? "확인 대기" : v.state === "approved" ? "승인" : "반려"}</Badge>
              </div>
              <p>{v.schoolName} {v.department}, {v.status === "student" ? "재학생" : "졸업생"}, {VERIFY_LABEL[v.method]}로 확인 요청 ({formatDateTime(v.createdAt)})</p>
              {v.schoolEmail && (
                <p>
                  학교 이메일: <b>{v.schoolEmail}</b>{" "}
                  {v.emailConfirmedAt ? <Badge tone="ok">메일 확인됨 {formatDateTime(v.emailConfirmedAt)}</Badge> : <Badge tone="neutral">메일 확인 전</Badge>}
                </p>
              )}
              {v.rosterNote && <p>졸업전시: <b>{v.rosterNote}</b></p>}
              {v.document && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/admin/verification-document/${v.document}`} alt="제출한 학생증이나 증명서" className="max-h-72 w-auto self-start rounded-lg" />
              )}
              {v.state === "rejected" && v.reason && <p className="text-ink-soft">반려 사유: {v.reason}</p>}
              {v.state === "new" && (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={decideVerification.bind(null, v.id, "approved")}><Button type="submit" size="sm">승인</Button></form>
                  <form action={decideVerification.bind(null, v.id, "rejected")} className="flex items-center gap-2">
                    <Input name="reason" placeholder="반려 사유 (회원에게 보여요)" aria-label="반려 사유" className="h-9 w-64" />
                    <Button type="submit" size="sm" variant="danger">반려</Button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
        {list.length === 0 && <p className="text-sm text-ink-soft">아직 인증 요청이 없어요.</p>}
      </ul>
    </>
  );
}
