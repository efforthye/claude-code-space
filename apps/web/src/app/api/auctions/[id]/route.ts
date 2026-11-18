import { store } from "@/lib/data/store";
import { currentUser } from "@/features/account/session";
import { settleDueAuctions, snapshot, userById } from "@/features/auction/server";

/**
 * 경매 화면이 몇 초마다 부르는 현재 상태 (현재가, 남은 시간, 입찰 내역, 내 상태).
 * 웹소켓 대신 짧은 폴링: 한 시즌 수백 점 규모라 충분하고, 서버리스에서 연결을 붙잡지 않는다.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/auctions/[id]">) {
  const { id } = await ctx.params;
  await settleDueAuctions();
  const [db, me] = await Promise.all([store.read(), currentUser()]);
  const a = db.auctions.find((x) => x.id === id && (x.state === "scheduled" || x.state === "closed"));
  if (!a) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(snapshot(db, a, userById(db, me?.id)), { headers: { "Cache-Control": "no-store" } });
}
