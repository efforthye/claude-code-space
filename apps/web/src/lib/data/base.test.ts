import { describe, expect, it } from "vitest";
import { buildBaseDatabase } from "./base";

describe("real fall-2026 exhibition data", () => {
  const db = buildBaseDatabase();
  it("has the 87 shows from 40 schools, all linked", () => {
    expect(db.exhibitions).toHaveLength(87);
    expect(db.schools).toHaveLength(40);
    const schoolIds = new Set(db.schools.map((s) => s.id));
    for (const e of db.exhibitions) expect(schoolIds.has(e.schoolId!)).toBe(true);
  });
  it("dates are valid ISO days with end ≥ start", () => {
    for (const e of db.exhibitions) {
      expect(e.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.endDate >= e.startDate).toBe(true);
    }
  });
  it("every imported show credits its source", () => {
    for (const e of db.exhibitions) expect(e.source?.url).toMatch(/^https:\/\//);
  });
  it("ships no works, artists or orders, those are never invented in production", () => {
    expect(db.works).toEqual([]);
    expect(db.artists).toEqual([]);
    expect(db.orders).toEqual([]);
  });
});
