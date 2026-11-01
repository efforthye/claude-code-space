import type { Artist, Database, Work } from "@/lib/domain/types";
import { buildBaseDatabase } from "./base";

/**
 * 개발용 예시 데이터. 작가·작품은 모두 가상이다 (사업계획서 화면 예시와 같은 원칙).
 * 실제 전시 일정(base) 위에 얹되, 가상 작품을 실제 전시에 출품한 것처럼 연결하지 않는다.
 * 실서비스(production)에서는 절대 시딩하지 않는다 — store.ts 참고.
 */
export function buildSampleDatabase(): Database {
  const now = "2026-11-01T00:00:00.000Z";

  const artist = (a: Partial<Artist> & Pick<Artist, "id" | "name">): Artist => ({
    schoolId: "sch-hongik",
    department: null,
    gradYear: 2027,
    status: "student",
    verifiedBy: "school_email",
    verifiedAt: "2026-10-28T10:00:00.000Z",
    bio: "",
    instagram: null,
    portfolioUrl: null,
    acceptsCommission: false,
    createdAt: now,
    ...a,
  });

  const artists: Artist[] = [
    artist({
      id: "art-jieun",
      name: "김지은",
      department: "회화과",
      bio: "빛이 오래 머무는 오후의 실내를 그립니다. 같은 창가를 여섯 달 동안 매일 같은 시간에 관찰했습니다.",
      instagram: "sample.jieun",
      acceptsCommission: true,
    }),
    artist({
      id: "art-hana",
      name: "정하나",
      department: "목조형가구학과",
      bio: "몸에 닿는 곡선을 나무로 옮깁니다. 앉는 사람의 자세가 바뀌는 가구를 만듭니다.",
      acceptsCommission: true,
    }),
    artist({
      id: "art-minseo",
      name: "이민서",
      schoolId: "sch-kookmin",
      department: "금속공예학과",
      verifiedBy: "student_id",
      bio: "두드려 늘린 금속의 표면에 남는 손의 흔적을 모읍니다.",
    }),
    artist({
      id: "art-yuna",
      name: "박유나",
      schoolId: "sch-ewha",
      department: "조형예술학부",
      gradYear: 2026,
      status: "graduate",
      verifiedBy: "roster",
      bio: "바다의 결을 판화로 찍습니다. 한 장도 같은 물결이 나오지 않습니다.",
    }),
    artist({
      id: "art-seojun",
      name: "최서준",
      department: "조소과",
      verifiedBy: null,
      verifiedAt: null,
      bio: "버려진 석고 틀로 다시 형태를 만듭니다.",
    }),
  ];

  const base = {
    depthCm: null,
    weightKg: null,
    edition: null,
    exhibitionId: null as string | null,
    kind: "graduation" as const,
    status: "available" as const,
    allowsPickup: true,
    operatorOwned: false,
    featured: false,
    createdAt: now,
    updatedAt: now,
    year: 2026,
  };
  const img = (n: number) => `/samples/art-${String(n).padStart(2, "0")}.svg`;

  const works: Work[] = [
    { ...base, id: "w-blue-afternoon", title: "푸른 오후의 기억", artistId: "art-jieun", medium: "painting", materials: "캔버스에 아크릴", widthCm: 72.7, heightCm: 60.6, price: 320_000, images: [img(1), img(7)], description: "창가에 오래 머무는 오후 네 시의 빛. 여섯 달 동안 같은 시간의 같은 창을 그렸습니다.", featured: true },
    { ...base, id: "w-night-garden", title: "밤의 정원", artistId: "art-jieun", medium: "painting", materials: "캔버스에 유채", widthCm: 53, heightCm: 45.5, price: 180_000, images: [img(2)], description: "불이 꺼진 뒤의 정원." },
    { ...base, id: "w-folding-chair", title: "접히는 의자", artistId: "art-hana", medium: "furniture", materials: "물푸레나무, 오일 마감", widthCm: 48, heightCm: 82, depthCm: 52, weightKg: 9, price: 420_000, images: [img(3), img(9)], description: "펼치면 의자, 접으면 벽에 거는 판이 됩니다." },
    { ...base, id: "w-curly-shelf", title: "곱슬 수납장", artistId: "art-hana", medium: "furniture", materials: "자작나무 합판, 도장", widthCm: 90, heightCm: 140, depthCm: 40, weightKg: 26, price: 1_200_000, images: [img(4)], description: "물결 모양 옆판의 수납장.", status: "reserved" },
    { ...base, id: "w-hammered-bowl", title: "두드린 그릇", artistId: "art-minseo", medium: "metal", materials: "동, 단조", widthCm: 18, heightCm: 7, depthCm: 18, weightKg: 0.6, price: 150_000, images: [img(5)], description: "천 번 넘게 두드려 늘린 동판 그릇." },
    { ...base, id: "w-silver-ring-set", title: "흔적 반지 세트", artistId: "art-minseo", medium: "metal", materials: "은 925", widthCm: 2, heightCm: 2, price: 90_000, images: [img(6)], description: "망치 자국을 남긴 은반지 세 점.", kind: "personal" },
    { ...base, id: "w-sea-grain", title: "바다의 결", artistId: "art-yuna", medium: "print", materials: "목판화, 한지", widthCm: 40, heightCm: 30, edition: "3/10", price: 95_000, images: [img(8)], description: "같은 판으로 찍어도 물결은 매번 다르게 나옵니다.", kind: "edition", allowsPickup: false },
    { ...base, id: "w-sea-grain-2", title: "바다의 결 II", artistId: "art-yuna", medium: "print", materials: "목판화, 한지", widthCm: 40, heightCm: 30, edition: "1/10", price: 95_000, images: [img(10)], description: "", kind: "edition", status: "sold" },
    { ...base, id: "w-plaster-form", title: "다시 선 형태", artistId: "art-seojun", medium: "sculpture", materials: "석고, 철", widthCm: 35, heightCm: 110, depthCm: 35, weightKg: 18, price: 650_000, images: [img(11), img(12)], description: "버려진 석고 틀을 쌓아 올렸습니다." },
    { ...base, id: "w-study-window", title: "창 연구 #4", artistId: "art-jieun", medium: "drawing", materials: "종이에 목탄", widthCm: 29.7, heightCm: 42, price: 60_000, images: [img(13)], description: "졸업작품을 위한 연구 드로잉.", kind: "study" },
    { ...base, id: "w-small-stool", title: "작은 스툴", artistId: "art-hana", medium: "furniture", materials: "오크", widthCm: 32, heightCm: 40, depthCm: 32, weightKg: 4, price: 210_000, images: [img(14)], description: "과제전에 냈던 스툴.", kind: "coursework" },
  ];

  return { ...buildBaseDatabase(), artists, works };
}
