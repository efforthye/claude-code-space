import "server-only";
import QRCode from "qrcode";

/** MAYO QR 색: 잉크 위 흰 바탕. 인쇄해도 잘 읽히도록 오류 정정 M, 여백 2칸. */
const OPTS = { margin: 2, errorCorrectionLevel: "M" as const, color: { dark: "#1d1530", light: "#ffffff" } };

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", ...OPTS });
}

export function qrPng(url: string, width = 1024) {
  return QRCode.toBuffer(url, { type: "png", width, ...OPTS });
}

/**
 * QR 이미지 응답. ?format=png 면 PNG(1024px), 아니면 SVG.
 * ?download=1 이면 파일로 저장되게 한다.
 */
export async function qrResponse(url: string, filename: string, search: URLSearchParams) {
  const png = search.get("format") === "png";
  const body = png ? new Uint8Array(await qrPng(url)) : await qrSvg(url);
  const headers: Record<string, string> = {
    "Content-Type": png ? "image/png" : "image/svg+xml",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  if (search.get("download") === "1") headers["Content-Disposition"] = `attachment; filename="${filename}.${png ? "png" : "svg"}"`;
  return new Response(body, { headers });
}
