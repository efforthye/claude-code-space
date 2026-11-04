import { describe, expect, it } from "vitest";
import { buildBaseDatabase } from "./base";
import { MongoStore, type StateCollection, type StateDoc } from "./mongo-store";

/** 메모리 속 가짜 컬렉션: 실제 Mongo처럼 중복 키 오류와 조건부 교체를 흉내 낸다. 매 호출 사이에 잠깐 쉬어 경쟁을 만든다. */
function fakeCollection() {
  let doc: StateDoc | null = null;
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 4));
  const col = {
    async findOne() {
      await tick();
      return doc ? structuredClone(doc) : null;
    },
    async insertOne(d: StateDoc) {
      await tick();
      if (doc) throw Object.assign(new Error("dup"), { code: 11000 });
      doc = structuredClone(d);
      return { acknowledged: true, insertedId: d._id };
    },
    async replaceOne(filter: { _id: string; version: number }, next: Omit<StateDoc, "_id">) {
      await tick();
      if (!doc || doc.version !== filter.version) return { matchedCount: 0, modifiedCount: 0 };
      doc = { _id: doc._id, ...structuredClone(next) };
      return { matchedCount: 1, modifiedCount: 1 };
    },
  } as unknown as StateCollection;
  return { col, current: () => doc };
}

const identity = <T,>(x: T) => x;

describe("MongoStore", () => {
  it("seeds once even when many instances read an empty database together", async () => {
    const { col, current } = fakeCollection();
    const stores = Array.from({ length: 5 }, () => new MongoStore(async () => col, buildBaseDatabase, identity));
    const dbs = await Promise.all(stores.map((s) => s.read()));
    expect(dbs.every((d) => d.exhibitions.length > 50)).toBe(true);
    expect(current()?.version).toBe(1);
  });

  it("two servers racing for the same work: exactly one reservation wins", async () => {
    const { col } = fakeCollection();
    const a = new MongoStore(async () => col, buildBaseDatabase, identity);
    const b = new MongoStore(async () => col, buildBaseDatabase, identity);
    await a.update((d) => d.works.push({ id: "w1", status: "available" } as never));
    const reserve = (s: MongoStore) =>
      s.update((d) => {
        const w = d.works.find((x) => x.id === "w1")!;
        if (w.status !== "available") return false;
        w.status = "reserved";
        return true;
      });
    const results = await Promise.all([reserve(a), reserve(b), reserve(a), reserve(b)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("concurrent writes from several servers are all kept", async () => {
    const { col } = fakeCollection();
    const stores = Array.from({ length: 3 }, () => new MongoStore(async () => col, buildBaseDatabase, identity));
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => stores[i % 3].update((d) => d.schools.push({ id: `m-${i}`, name: `${i}`, shortName: `${i}` }))),
    );
    const db = await stores[0].read();
    expect(db.schools.filter((s) => s.id.startsWith("m-"))).toHaveLength(12);
  });
});
