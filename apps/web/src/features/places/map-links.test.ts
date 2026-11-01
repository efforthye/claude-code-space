import { describe, expect, it } from "vitest";
import { mapLinks, mapQuery } from "./map-links";

describe("지도 검색어", () => {
  it("drops floors, halls and campus notes, and keeps a venue that stands on its own", () => {
    expect(mapQuery("홍익대학교 대학로 아트센터 B2 제3전시장 (글로컬캠퍼스)", null, "건국대학교")).toBe("홍익대학교 대학로 아트센터");
    expect(mapQuery("비전타워 B1 갤러리", null, "가천대학교")).toBe("가천대학교 비전타워");
    expect(mapQuery("마루아트센터 그랜드관 (신관 3F)", null, "국민대학교")).toBe("마루아트센터 그랜드관");
    expect(mapQuery("NOL 서경스퀘어 B1 스콘갤러리", null, "서경대학교")).toBe("NOL 서경스퀘어");
  });
  it("prefixes the school for buildings inside a campus", () => {
    expect(mapQuery("조형관 1층 로비", null, "서울과학기술대학교")).toBe("서울과학기술대학교 조형관");
  });
  it("prefers the road address of a picked place", () => {
    const place = { name: "홍익대학교 홍문관", address: "서울 마포구 와우산로 94", lat: 37.55, lng: 126.92, url: "https://place.map.kakao.com/1" };
    expect(mapQuery("아무거나", place)).toBe("서울 마포구 와우산로 94");
    const links = mapLinks("아무거나", place);
    expect(links.map((l) => l.id)).toEqual(["naver", "kakao", "google"]);
    expect(links[1].href).toBe("https://place.map.kakao.com/1");
    expect(links[2].href).toContain("query=37.55,126.92");
  });
});
