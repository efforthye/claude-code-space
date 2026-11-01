import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관">
      <section>
        <h2>1. MAYO의 역할</h2>
        <p>MAYO는 작가와 구매자를 연결하는 통신판매중개자입니다. 작가가 직접 판매하는 거래의 당사자가 아니며, 작품 정보의 1차 책임은 판매자(작가)에게 있습니다.</p>
      </section>
      <section>
        <h2>2. 주문과 결제</h2>
        <ul>
          <li>주문 신청 시 작품은 예약되며, 안내된 기한(신청 후 48시간) 안에 입금이 확인되지 않으면 예약이 취소될 수 있습니다.</li>
          <li>미술품 전문 운송이 필요한 작품은 운송 견적을 안내한 뒤 동의를 받아 운송비를 따로 받습니다.</li>
        </ul>
      </section>
      <section>
        <h2>3. 청약철회</h2>
        <ul>
          <li>작품을 받은 날부터 7일 이내에 청약을 철회할 수 있습니다.</li>
          <li>작품이 표시·광고와 다르거나 계약과 다르게 이행된 경우 받은 날부터 3개월 이내, 그 사실을 안 날(알 수 있었던 날)부터 30일 이내에 철회할 수 있습니다.</li>
          <li>주문제작 작품은 결제 전에 청약철회 제한을 별도로 안내하고 동의받은 경우에 한해 철회가 제한될 수 있습니다.</li>
        </ul>
      </section>
      <section>
        <h2>4. 저작권</h2>
        <p>작품을 구매하면 작품(원본)의 소유권을 얻습니다. 저작권은 작가에게 남으며, 작품 이미지의 복제·배포에는 작가의 허락이 필요합니다.</p>
      </section>
    </LegalPage>
  );
}
