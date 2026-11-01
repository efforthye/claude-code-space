import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reviewExhibitionRequest } from "@/features/admin/actions";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { EXHIBITION_KIND_LABEL, ORGANIZER_LABEL, SUPPORT_LABEL } from "@/lib/domain/rules";
import { formatDateTime, formatPeriod } from "@/lib/format";

const STATE = { new: "새 신청", approved: "등록함", rejected: "보류" } as const;

export default async function AdminExhibitionRequests() {
  const db = await adminDb();
  const reqs = [...db.exhibitionRequests].sort(
    (a, b) => Number(b.state === "new") - Number(a.state === "new") || b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <>
      <AdminHeading title="전시 등록 신청" description="승인하면 전시가 만들어지고 수정 화면으로 이동해요. 소개 글과 링크를 채운 뒤 QR 라벨을 뽑으면 됩니다." />
      {reqs.length === 0 && <p className="text-sm text-ink-soft">아직 신청이 없어요.</p>}
      <ul className="flex flex-col gap-3">
        {reqs.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.state === "new" ? "warn" : r.state === "approved" ? "ok" : "neutral"}>{STATE[r.state]}</Badge>
              <Badge>{EXHIBITION_KIND_LABEL[r.kind]}</Badge>
              <b className="text-base">{r.title}</b>
              <span className="ml-auto text-xs text-ink-soft">{formatDateTime(r.createdAt)}</span>
            </div>
            <p className="text-ink-soft">
              {[r.schoolName, r.department].filter(Boolean).join(" ")}, {formatPeriod(r.startDate, r.endDate)}, {r.venue}
              {r.artistCount != null && `, 작가 ${r.artistCount}명`}
            </p>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="inline text-ink-soft">신청 </dt><dd className="inline">{ORGANIZER_LABEL[r.organizer]}, {r.contactName}</dd></div>
              <div><dt className="inline text-ink-soft">연락처 </dt><dd className="inline">{r.phone}, {r.email}</dd></div>
              <div className="sm:col-span-2"><dt className="inline text-ink-soft">원하는 지원 </dt><dd className="inline">{r.support.map((x) => SUPPORT_LABEL[x]).join(", ") || "없음"}</dd></div>
            </dl>
            {r.message && <p className="rounded-sm bg-mist p-3 whitespace-pre-line">{r.message}</p>}
            {r.state === "new" ? (
              <div className="flex gap-2">
                <form action={reviewExhibitionRequest.bind(null, r.id, "approved")}><Button type="submit" size="sm">승인하고 전시 만들기</Button></form>
                <form action={reviewExhibitionRequest.bind(null, r.id, "rejected")}><Button type="submit" size="sm" variant="secondary">보류</Button></form>
              </div>
            ) : (
              r.exhibitionId && <Link href={`/admin/exhibitions/${r.exhibitionId}`} className="w-fit text-xs underline">만든 전시 보기</Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
