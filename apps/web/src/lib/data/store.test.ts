import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBaseDatabase } from "./base";
import { LocalJsonStore } from "./store";

const tempStore = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mayo-store-"));
  const file = path.join(dir, "db.json");
  return { file, store: new LocalJsonStore(file, buildBaseDatabase) };
};

describe("LocalJsonStore", () => {
  it("seeds on first read and persists updates", async () => {
    const { file, store } = await tempStore();
    const db = await store.read();
    expect(db.exhibitions.length).toBeGreaterThan(50);
    await store.update((d) => d.schools.push({ id: "sch-x", name: "테스트대학교", shortName: "테스트대" }));
    const onDisk = JSON.parse(await readFile(file, "utf8"));
    expect(onDisk.schools.some((s: { id: string }) => s.id === "sch-x")).toBe(true);
  });

  it("serialises concurrent writes so nothing is lost", async () => {
    const { store } = await tempStore();
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.update((d) => d.schools.push({ id: `sch-${i}`, name: `${i}`, shortName: `${i}` })),
      ),
    );
    const db = await store.read();
    expect(db.schools.filter((s) => s.id.match(/^sch-\d+$/)).length).toBe(25);
  });

  it("only one of two racing buyers can reserve the same work", async () => {
    const { store } = await tempStore();
    await store.update((d) => d.works.push({ id: "w1", status: "available" } as never));
    const reserve = () =>
      store.update((d) => {
        const w = d.works.find((x) => x.id === "w1")!;
        if (w.status !== "available") return false;
        w.status = "reserved";
        return true;
      });
    const results = await Promise.all([reserve(), reserve(), reserve()]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("a failed mutation does not block later writes", async () => {
    const { store } = await tempStore();
    await expect(store.update(() => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(store.update(() => "ok")).resolves.toBe("ok");
  });
});

describe("migrate", () => {
  it("turns legacy image lists into media items", async () => {
    const { migrate } = await import("./store");
    const db = buildBaseDatabase();
    db.works.push({ id: "old", images: ["/a.jpg", "/b.jpg"] } as never);
    const out = migrate(db);
    expect(out.works[0].media).toEqual([
      { kind: "image", src: "/a.jpg" },
      { kind: "image", src: "/b.jpg" },
    ]);
    expect("images" in out.works[0]).toBe(false);
  });

  it("fills artist groups and the new artist and work fields on old data", async () => {
    const { migrate } = await import("./store");
    const db = buildBaseDatabase();
    db.artistGroups = [];
    db.artists.push({ id: "a-old", status: "student" } as never);
    db.works.push({ id: "w-old", media: [] } as never);
    const out = migrate(db);
    expect(out.artistGroups.map((g) => g.id)).toContain("late");
    expect(out.artists.at(-1)).toMatchObject({ birthYear: null, deathYear: null, estate: null });
    expect(out.works.at(-1)).toMatchObject({ story: [], consignor: null, provenance: null, appraisal: null });
  });
});
