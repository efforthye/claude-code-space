import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reviewApplication } from "@/features/admin/actions";
import { AdminHeading } from "@/features/admin/ui";
import { adminDb } from "@/features/admin/session";
import { ARTIST_STATUS_LABEL } from "@/lib/domain/rules";
import { formatDateTime } from "@/lib/format";

const STATE = { new: "새 신청", approved: "승인", rejected: "보류" } as const;

export default async function AdminApplications() {
  const db = await adminDb();
  const apps = [...db.applications].sort((a, b) => (a.state === "new" ? -1 : 1) - (b.state === "new" ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <AdminHeading title="입점 신청" description="승인하면 작가 프로필이 만들어져요. 학교 인증은 서류를 확인한 뒤 작가 화면에서 따로 표시합니다." />
      {apps.length === 0 && <p className="text-sm text-ink-soft">아직 신청이 없어요.</p>}
      <ul className="flex flex-col gap-3">
        {apps.map((a) => (
          <li key={a.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={a.state === "new" ? "warn" : a.state === "approved" ? "ok" : "neutral"}>{STATE[a.state]}</Badge>
              <b className="text-base">{a.name}</b>
              <span className="text-ink-soft">{ARTIST_STATUS_LABEL[a.status]}, {[a.schoolName, a.department, a.gradYear && `${a.gradYear} 졸업(예정)`].filter(Boolean).join(", ")}</span>
              <span className="ml-auto text-xs text-ink-soft">{formatDateTime(a.createdAt)}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="inline text-ink-soft">이메일 </dt><dd className="inline">{a.email}</dd></div>
              <div><dt className="inline text-ink-soft">휴대폰 </dt><dd className="inline">{a.phone}</dd></div>
              <div><dt className="inline text-ink-soft">출생연도 </dt><dd className="inline">{a.birthYear}</dd></div>
              {a.guardian && <div className="text-warn"><dt className="inline">보호자 </dt><dd className="inline">{a.guardian.name}, {a.guardian.phone} (동의 받음)</dd></div>}
              {a.instagram && <div><dt className="inline text-ink-soft">인스타 </dt><dd className="inline">@{a.instagram}</dd></div>}
              {a.portfolioUrl && <div><dt className="inline text-ink-soft">포트폴리오 </dt><dd className="inline"><a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer" className="underline">{a.portfolioUrl}</a></dd></div>}
            </dl>
            {a.message && <p className="rounded-sm bg-mist p-3 whitespace-pre-line">{a.message}</p>}
            {a.state === "new" && (
              <div className="flex gap-2">
                <form action={reviewApplication.bind(null, a.id, "approved")}><Button type="submit" size="sm">승인하고 작가 만들기</Button></form>
                <form action={reviewApplication.bind(null, a.id, "rejected")}><Button type="submit" size="sm" variant="secondary">보류</Button></form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
