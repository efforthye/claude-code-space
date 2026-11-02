import { qrResponse } from "@/features/share/qr";
import { findCertificate } from "@/features/certificates/queries";
import { siteConfig } from "@/lib/site";

/** 작품 보증서 확인 QR. 있는 보증서만. */
export async function GET(req: Request, ctx: RouteContext<"/qr/certificate/[code]">) {
  const { code } = await ctx.params;
  const cert = await findCertificate(decodeURIComponent(code));
  if (!cert) return new Response("Not found", { status: 404 });
  return qrResponse(`${siteConfig.url}/certificates/${cert.code}`, `mayo-certificate-${cert.code}`, new URL(req.url).searchParams);
}
