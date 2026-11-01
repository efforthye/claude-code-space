import { connection } from "next/server";
import { requireAdmin } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";
import { getBusinessInfo } from "@/lib/site";

const SOURCE = "https://www.gangnam.go.kr/board/B_000060/1071356/view.do?mid=ID03_01";
const GRACE_END = "2027-07-25"; // 계도기간 끝 (이날까지 신고하면 과태료 없음)

/** 운영자용 신고 체크리스트. 출처: 강남구 민원서식 '미술 서비스업 신고 안내' (문화도시과, 2026-07-28 게시). */
export default async function AdminCompliance() {
  await requireAdmin();
  await connection();
  const biz = getBusinessInfo();
  const done = biz.artServiceNumber !== "등록 예정";
  const daysLeft = daysUntil(GRACE_END);

  return (
    <>
      <AdminHeading
        title="미술서비스업 신고"
        description="미술진흥법 제18조. 타인의 작품을 계속 판매, 중개하는 온라인 플랫폼도 신고 대상이에요."
      />

      <section className="glass mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-violet">{done ? "신고 완료" : "아직 신고 전"}</span>
          <p className="text-lg font-bold">
            {done ? `신고번호 ${biz.artServiceNumber}` : `계도기간 끝까지 ${daysLeft}일 (${GRACE_END.replaceAll("-", ".")})`}
          </p>
          <p className="text-sm text-ink-soft">
            {done
              ? "변경 사항(주소, 대표, 업종)이 생기면 바꾸기 전에 변경신고를 해야 해요."
              : "계도기간 안에 신고하면 과태료가 없어요. 신고 후 Vercel 환경변수 BUSINESS_ART_SERVICE_NO에 번호를 넣으면 사이트 하단에 바로 표시돼요."}
          </p>
        </div>
        <a href={SOURCE} target="_blank" rel="noopener noreferrer" className="link-sweep text-sm font-semibold text-violet">강남구 안내 원문 →</a>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="어디에, 어떻게">
          <Item>강남구<b>보건소</b> 5층 문화도시과 방문 접수 (구청이 아니에요)</Item>
          <Item>수수료 0원, 처리 3일. 완료 문자를 받으면 문화도시과에서 신고증 수령 (대리인 수령 가능)</Item>
          <Item>온라인 접수 창구는 없어요. 가기 전에 문화도시과에 전화로 서류를 한 번 더 확인하세요</Item>
        </Card>

        <Card title="챙길 서류 (개인사업자 신규)">
          <Item>미술 서비스업 신고서: 미술진흥법 시행규칙 별지 제1호서식 (강남구 안내 페이지 하단 첨부)</Item>
          <Item>임대차계약서 사본 (본인 소유 사무실이면 건물등기사항증명서). 공유 오피스라면 그 계약서로 되는지 미리 물어보세요</Item>
          <Item>사업자등록증명</Item>
          <Item>대리인이 가면: 인감 날인 위임장, 대표 개인 인감증명서, 대리인 신분증</Item>
          <Note>행정정보 공동이용 권한이 생기기 전(2026.10.1 예정)에는 확인 서류를 모두 지참해야 했어요. 지금은 일부 생략될 수 있으니 전화로 확인하세요.</Note>
        </Card>

        <Card title="업종 고르기">
          <Item>신고 업종은 화랑업, 미술품 경매업, 미술품 자문업, 미술품 대여와 판매업, 미술품 감정업, 미술 전시업 여섯 가지</Item>
          <Item>MAYO는 작가 작품 판매 중개라 <b>미술품 대여와 판매업</b>이 기본. 경매를 열면 <b>미술품 경매업</b>도 함께 확인</Item>
          <Item>작고 작가 작품이나 2차 거래(소장자 판매)를 받을수록 판매업 성격이 강해져요</Item>
        </Card>

        <Card title="신고 뒤에 지켜야 할 것">
          <Item>미술품 유통 내역 관리 (관리자 &gt; 거래 장부가 그 기록)</Item>
          <Item>경매를 하면 낙찰가와 대금 완납 여부 공시</Item>
          <Item>구매자가 요구하면 진품증명서(작품 보증서) 발급</Item>
          <Item>주소, 대표, 업종이 바뀌면 바꾸기 전에 변경신고</Item>
          <Item>사이트 하단에 신고번호 표시 (BUSINESS_ART_SERVICE_NO)</Item>
        </Card>

        <Card title="안 하면">
          <Item>신고 없이 영업: 과태료 1차 200만원, 2차 350만원, 3차 500만원</Item>
          <Item>변경, 승계 신고 누락: 1차 50만원, 2차 100만원, 3차 250만원</Item>
          <Item>계도기간 2026.7.26부터 2027.7.25까지는 과태료 없음</Item>
        </Card>

        <Card title="같이 확인할 것">
          <Item>통신판매업 신고(2024-서울강남-06400)의 판매 방식, 취급 품목, 도메인에 미술품 중개와 mayo.im이 들어가 있는지. 다르면 변경신고</Item>
          <Item>업종 해석이 애매하면 문화도시과에 MAYO 구조(중개, 경매 예정)를 설명하고 업종을 같이 정하세요</Item>
        </Card>
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        출처: 강남구 민원서식 &lsquo;미술 서비스업 신고 안내&rsquo; (문화도시과, 2026.7.28 게시), 미술진흥법 제18조, 시행령 제10조의2부터 제10조의5, 시행령 별표1, 별표2.
        법률 자문이 아니라 공개 안내를 정리한 메모예요.
      </p>
    </>
  );
}

function daysUntil(day: string) {
  return Math.ceil((Date.parse(`${day}T23:59:59+09:00`) - Date.now()) / 86_400_000);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col gap-3 rounded-lg p-5">
      <h2 className="font-bold">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed">{children}</ul>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-violet" />
      <span>{children}</span>
    </li>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <li className="rounded-md bg-violet/5 p-3 text-xs text-ink-soft">{children}</li>;
}
