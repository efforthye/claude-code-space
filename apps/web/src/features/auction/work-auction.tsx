import { connection } from "next/server";
import { store } from "@/lib/data/store";
import { currentUser } from "@/features/account/session";
import { AuctionPanel } from "./auction-panel";
import { activeAuctionFor, settleDueAuctions, snapshot, userById } from "./server";

/** 작품 화면의 경매 칸. 매 요청 새로 읽는다 (카탈로그 캐시와 따로) */
export async function WorkAuction({ workId }: { workId: string }) {
  await connection();
  await settleDueAuctions();
  const [db, me] = await Promise.all([store.read(), currentUser()]);
  const a = activeAuctionFor(db, workId);
  if (!a) return <p className="text-sm text-ink-soft">경매가 끝났어요. 새로고침하면 지금 판매 상태를 볼 수 있어요.</p>;
  return <AuctionPanel initial={snapshot(db, a, userById(db, me?.id))} loginHref={`/login?next=${encodeURIComponent(`/works/${workId}`)}`} />;
}
