import { serveMedia } from "@/lib/data/uploads";

export async function GET(req: Request, ctx: RouteContext<"/media/[name]">) {
  const { name } = await ctx.params;
  return serveMedia(name, req.headers.get("range"));
}
