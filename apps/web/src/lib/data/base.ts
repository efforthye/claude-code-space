import { DEFAULT_ARTIST_GROUPS, DEFAULT_CATEGORIES } from "@/lib/domain/rules";
import type { Database } from "@/lib/domain/types";
import fall2026 from "./seed/fall-2026-exhibitions.json";

/**
 * 실서비스에도 처음부터 보이는 공개 정보: 학교 목록과 실제 졸업전시 일정.
 * 출처와 정리 방법은 JSON의 _comment와 wiki/services/web.md 참고.
 */
export function buildBaseDatabase(): Database {
  return {
    categories: structuredClone(DEFAULT_CATEGORIES),
    artistGroups: structuredClone(DEFAULT_ARTIST_GROUPS),
    certificates: [],
    users: [],
    sessions: [],
    verifications: [],
    settings: { logoMark: "glass" },
    schools: structuredClone(fall2026.schools),
    exhibitions: structuredClone(fall2026.exhibitions),
    artists: [],
    works: [],
    orders: [],
    applications: [],
    exhibitionRequests: [],
    inquiries: [],
  };
}
