import { qrResponse } from "@/features/share/qr";
import { store } from "@/lib/data/store";
import { siteConfig } from "@/lib/site";

/** 작품 QR (전시장 캡션의 짧은 주소 /q/<id>). 있는 작품만, 임의 주소의 QR은 만들지 않는다. */
export async function GET(req: Request, ctx: RouteContext<"/qr/work/[id]">) {
  const { id } = await ctx.params;
  const db = await store.read();
  const work = db.works.find((w) => w.id === id && w.status !== "hidden");
  if (!work) return new Response("Not found", { status: 404 });
  return qrResponse(`${siteConfig.url}/q/${work.id}`, `mayo-qr-${work.id}`, new URL(req.url).searchParams);
}
