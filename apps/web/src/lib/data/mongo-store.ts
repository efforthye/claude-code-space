import "server-only";
import { MongoClient, type Collection } from "mongodb";
import type { Database } from "@/lib/domain/types";
import type { Store } from "./store";

/** 저장소 문서 한 개: 전체 데이터와 버전 번호 */
export type StateDoc = { _id: string; version: number; data: Database; updatedAt: Date };

/** 테스트에서 가짜로 바꿔 끼울 수 있게, 실제로 쓰는 메서드만 */
export type StateCollection = Pick<Collection<StateDoc>, "findOne" | "insertOne" | "replaceOne">;

const DOC_ID = "db";
const MAX_RETRIES = 8;

/**
 * MongoDB 저장소. 지금 데이터 규모(학교, 전시, 작품 수백 건)에서는 전체를 문서 하나에 두고
 * 버전 번호로 낙관적 잠금을 건다: 읽은 버전이 그대로일 때만 저장하고, 그 사이 누가 먼저
 * 저장했으면 새로 읽어서 다시 적용한다. 그래서 같은 작품을 동시에 주문해도 한 명만 예약된다.
 * (여러 서버리스 인스턴스가 동시에 써도 안전. 데이터가 커지면 컬렉션별로 나눈다, ADR 0029)
 */
export class MongoStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private collection: () => Promise<StateCollection>,
    private seed: () => Database,
    private migrate: (db: Database) => Database,
  ) {}

  private async load(): Promise<{ db: Database; version: number }> {
    const col = await this.collection();
    const doc = await col.findOne({ _id: DOC_ID });
    if (doc) return { db: this.migrate(doc.data), version: doc.version };
    // 처음 한 번: 기본 데이터를 넣는다. 다른 인스턴스가 먼저 넣었으면(중복 키) 그걸 읽는다.
    const data = this.seed();
    try {
      await col.insertOne({ _id: DOC_ID, version: 1, data, updatedAt: new Date() });
      return { db: structuredClone(data), version: 1 };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      const again = await col.findOne({ _id: DOC_ID });
      if (!again) throw err;
      return { db: this.migrate(again.data), version: again.version };
    }
  }

  async read() {
    return (await this.load()).db;
  }

  update<T>(mutate: (db: Database) => T): Promise<T> {
    // 같은 인스턴스 안에서는 차례대로 (충돌 재시도를 줄인다)
    const run = this.queue.then(async () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { db, version } = await this.load();
        const result = mutate(db);
        const res = await (await this.collection()).replaceOne(
          { _id: DOC_ID, version },
          { version: version + 1, data: db, updatedAt: new Date() },
        );
        if (res.matchedCount === 1) return result;
        // 다른 인스턴스가 먼저 저장했다: 잠깐 쉬었다가 새 데이터로 다시
        await new Promise((r) => setTimeout(r, 15 * (attempt + 1) + Math.random() * 25));
      }
      throw new Error("저장이 몰려서 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/** 프로세스당 연결 하나 (서버리스에서 요청마다 새로 연결하지 않도록) */
let client: Promise<MongoClient> | null = null;
export function mongoCollection(uri: string, dbName: string) {
  return async () => {
    client ??= new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
    return (await client).db(dbName).collection<StateDoc>("state");
  };
}
