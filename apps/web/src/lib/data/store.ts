import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database } from "@/lib/domain/types";
import { buildSampleDatabase } from "./sample";

/**
 * Storage seam. Pages and actions only talk to `store`; swapping the local JSON
 * file for mayo-api (or a hosted DB) is a change in this file, not in features.
 * See wiki ADR 0028.
 */
export interface Store {
  read(): Promise<Database>;
  /** Apply a mutation atomically and persist it. Returns what the mutator returns. */
  update<T>(mutate: (db: Database) => T): Promise<T>;
}

const EMPTY: Database = {
  schools: [],
  artists: [],
  exhibitions: [],
  works: [],
  orders: [],
  applications: [],
};

/** Local development store: one JSON file under `.data/` (git-ignored). */
class LocalJsonStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string) {}

  private async load(): Promise<Database> {
    try {
      return { ...EMPTY, ...JSON.parse(await fs.readFile(this.file, "utf8")) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      // 예시 데이터는 개발 환경에서만 — 실서비스에 가짜 작품이 판매 중으로 뜨면 안 된다.
      const db = process.env.MAYO_SAMPLE_DATA === "off" || process.env.NODE_ENV === "production"
        ? structuredClone(EMPTY)
        : buildSampleDatabase();
      await this.save(db);
      return db;
    }
  }

  private async save(db: Database) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, this.file);
  }

  read() {
    return this.load();
  }

  update<T>(mutate: (db: Database) => T): Promise<T> {
    // Serialise writes so two submissions can't both reserve the same work.
    const run = this.queue.then(async () => {
      const db = await this.load();
      const result = mutate(db);
      await this.save(db);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export const store: Store = new LocalJsonStore(
  path.join(process.cwd(), ".data", "db.json"),
);
