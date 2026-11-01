import { redirect } from "next/navigation";

/**
 * 전시장 QR 캡션이 가리키는 짧은 주소. 인쇄된 라벨은 바꿀 수 없으니, 작품 페이지
 * 경로가 바뀌어도 이 주소만 유지하면 된다. (스캔 수 집계도 나중에 여기에 붙인다.)
 */
export async function GET(_req: Request, ctx: RouteContext<"/q/[id]">) {
  const { id } = await ctx.params;
  redirect(`/works/${encodeURIComponent(id)}`);
}
