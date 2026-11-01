import type { NextRequest } from "next/server";

/**
 * 장소 검색 프록시 (카카오 로컬 키워드 검색). REST 키는 서버에만 둔다.
 * 키가 없으면 501을 돌려주고, 화면은 우편번호 서비스로 대신 찾는다.
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
 */
type KakaoDoc = {
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_name: string;
  x: string;
  y: string;
  place_url: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 60) return Response.json({ places: [] });
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return Response.json({ places: [], fallback: true }, { status: 501 });

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", q);
  url.searchParams.set("size", "8");
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
  if (!res.ok) return Response.json({ places: [], error: "search_failed" }, { status: 502 });
  const data = (await res.json()) as { documents: KakaoDoc[] };
  return Response.json(
    {
      places: data.documents.map((d) => ({
        name: d.place_name,
        address: d.road_address_name || d.address_name || null,
        category: d.category_name,
        lat: Number(d.y) || null,
        lng: Number(d.x) || null,
        url: d.place_url || null,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
