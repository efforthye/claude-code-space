/**
 * 히어로 그래픽: 작품 사진 대신 오로라 빛과 비어 있는 유리 액자.
 * "다음 작품이 걸릴 자리", 숫자 카드는 실제 데이터에서 온다.
 */
export function HeroVisual({ shows, schools, artists }: { shows: number; schools: number; artists: number }) {
  return (
    <div aria-hidden className="relative isolate h-[420px] sm:h-[540px]">
      {/* 천천히 흐르는 빛 */}
      <span className="absolute top-[6%] left-[10%] size-64 animate-[drift_14s_ease-in-out_infinite] rounded-full bg-[#ff9ccb] opacity-70 blur-3xl" />
      <span className="absolute top-[30%] right-[4%] size-72 animate-[drift_18s_ease-in-out_infinite_reverse] rounded-full bg-[#a9b8ff] opacity-70 blur-3xl" />
      <span className="absolute bottom-[4%] left-[26%] size-60 animate-[drift_16s_ease-in-out_infinite] rounded-full bg-[#ffc79a] opacity-70 blur-3xl" />

      {/* 비어 있는 유리 액자 */}
      <div className="absolute top-1/2 left-1/2 aspect-[4/5] w-[58%] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border border-white/90 bg-white/35 p-4 shadow-[0_40px_80px_-40px_rgb(60_30_120/0.45)] backdrop-blur-xl">
        <div className="flex size-full flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-ink/15">
          <span className="font-display text-4xl italic text-ink/70 sm:text-5xl">your object</span>
          <span className="text-xs font-semibold tracking-wide text-ink-soft">다음 작품이 걸릴 자리</span>
        </div>
      </div>

      {/* 떠 있는 숫자 카드 */}
      <div className="glass absolute top-[10%] right-[2%] animate-[float_7s_ease-in-out_infinite] rounded-[18px] px-4 py-3">
        <p className="font-display text-3xl leading-none">{shows}</p>
        <p className="mt-1 text-xs font-semibold text-ink-soft">이번 시즌 졸업전시</p>
      </div>
      <div className="glass absolute bottom-[14%] left-0 animate-[float_8s_ease-in-out_infinite_1s] rounded-[18px] px-4 py-3">
        <p className="font-display text-3xl leading-none">{schools}</p>
        <p className="mt-1 text-xs font-semibold text-ink-soft">참여 학교</p>
      </div>
      {artists > 0 && (
        <div className="glass absolute right-[6%] bottom-[4%] animate-[float_9s_ease-in-out_infinite_2s] rounded-[18px] px-4 py-3">
          <p className="font-display text-3xl leading-none">{artists}</p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">학교 인증 작가</p>
        </div>
      )}
    </div>
  );
}
