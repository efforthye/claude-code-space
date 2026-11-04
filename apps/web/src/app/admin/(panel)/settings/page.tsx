import { Logo } from "@/components/brand/logo";
import { setLogoMark } from "@/features/admin/actions";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { cn } from "@/lib/cn";
import { LOGO_MARKS, type LogoMark } from "@/lib/domain/types";

const LABEL: Record<LogoMark, { title: string; desc: string }> = {
  glass: { title: "스테인드글라스", desc: "금테 안의 색유리 조각. 기본 로고." },
  painting: { title: "액자 속 그림", desc: "금빛 액자 m 안에 밤하늘 풍경." },
};

export default async function AdminSettings() {
  const db = await adminDb();
  const current = db.settings.logoMark;
  return (
    <>
      <AdminHeading title="사이트 설정" description="로고 마크를 바꾸면 헤더, 푸터, 브라우저 탭 아이콘, 홈 화면 아이콘이 함께 바뀌어요. 브라우저는 아이콘을 오래 기억해서 탭에는 늦게 보일 수 있어요." />
      <h2 className="mb-3 font-bold">로고 마크</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {LOGO_MARKS.map((mark) => (
          <form key={mark} action={setLogoMark.bind(null, mark)}>
            <button
              type="submit"
              aria-pressed={current === mark}
              className={cn(
                "glass flex w-full flex-col items-start gap-4 rounded-xl p-6 text-left transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5",
                current === mark ? "ring-2 ring-violet" : "hover:shadow-lg",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-bold">{LABEL[mark].title}</span>
                {current === mark ? <span className="bg-aurora rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">사용 중</span> : <span className="text-xs text-violet">이걸로 바꾸기</span>}
              </div>
              <Logo mark={mark} className="text-[56px]" />
              <div className="flex items-end gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/${mark}/icon-192.png`} alt="" className="size-12 rounded-[11px]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/${mark}/icon.svg`} alt="" className="size-6" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/${mark}/icon.svg`} alt="" className="size-4" />
                <span className="rounded-md bg-white px-3 py-2"><Logo mark={mark} className="text-[22px]" /></span>
              </div>
              <span className="text-sm text-ink-soft">{LABEL[mark].desc}</span>
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
