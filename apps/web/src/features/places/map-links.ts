import type { Place } from "@/lib/domain/types";

/** 검색어에서 뺄 층, 호실, 전시실 표기 (지도 검색은 건물 이름까지만 알아듣는다) */
const DETAIL = /^(지하\d*층?|B\d+F?|\d+F|\d+층|\d+(~|-)\d+층|[A-Z]?\d+호?|제?\d+(전시|세미나)?(장|실|관)|전시(장|실)|로비|[A-Z]동|\d+관)$/i;
/** 이 단어가 있으면 그 자체로 찾을 수 있는 장소라 학교 이름을 붙이지 않는다 */
const LANDMARK = /대학|센터|갤러리|미술관|아트|스퀘어|플라자|박물관/;

/**
 * 지도에서 찾을 검색어. 도로명 주소가 있으면 그게 가장 정확하다.
 * 없으면 장소 이름에서 괄호, 층, 전시실을 걷어 내고, 학교 안 건물 이름이면 학교 이름을 앞에 붙인다.
 */
export function mapQuery(venue: string, place: Place | null, schoolName?: string | null) {
  if (place?.address) return place.address;
  const head = (place?.name ?? venue).replace(/\([^)]*\)/g, " ").split(/[,·/]/)[0];
  const words = head.split(/\s+/).filter(Boolean);
  // 첫 층, 호실 표기부터 뒤는 모두 건물 안 위치라 자른다
  const cut = words.findIndex((w, i) => i > 0 && DETAIL.test(w));
  const cleaned = (cut > 0 ? words.slice(0, cut) : words).join(" ");
  if (schoolName && !LANDMARK.test(cleaned) && !cleaned.includes(schoolName)) return `${schoolName} ${cleaned}`;
  return cleaned;
}

export type MapLink = { id: "naver" | "kakao" | "google"; label: string; href: string };

export function mapLinks(venue: string, place: Place | null, schoolName?: string | null): MapLink[] {
  const q = encodeURIComponent(mapQuery(venue, place, schoolName));
  const at = place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null;
  return [
    { id: "naver", label: "네이버 지도", href: `https://map.naver.com/p/search/${q}` },
    {
      id: "kakao",
      label: "카카오맵",
      // 장소 검색으로 고른 곳이면 카카오 장소 페이지가 가장 정확하다
      href: place?.url ?? (at ? `https://map.kakao.com/link/map/${encodeURIComponent(place!.name)},${at.lat},${at.lng}` : `https://map.kakao.com/link/search/${q}`),
    },
    { id: "google", label: "구글 지도", href: `https://www.google.com/maps/search/?api=1&query=${at ? `${at.lat},${at.lng}` : q}` },
  ];
}
