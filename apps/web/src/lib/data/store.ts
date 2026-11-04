import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database } from "@/lib/domain/types";
import { DEFAULT_ARTIST_GROUPS, DEFAULT_CATEGORIES } from "@/lib/domain/rules";
import { LOGO_MARKS } from "@/lib/domain/types";
import { buildBaseDatabase } from "./base";
import { USE_MONGO } from "./mongo";
import { MongoStore, mongoCollection } from "./mongo-store";
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
  categories: [],
  artistGroups: [],
  certificates: [],
  users: [],
  sessions: [],
  verifications: [],
  settings: { logoMark: "glass" },
  schools: [],
  artists: [],
  exhibitions: [],
  works: [],
  orders: [],
  applications: [],
  exhibitionRequests: [],
  inquiries: [],
};

/** Local development store: one JSON file under `.data/` (git-ignored). */
export class LocalJsonStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();
  /** 파일이 없을 때 여러 요청이 동시에 처음 읽어도 시딩은 한 번만 */
  private seeding: Promise<Database> | null = null;

  constructor(
    private file: string,
    private seed: () => Database = defaultSeed,
  ) {}

  private async load(): Promise<Database> {
    try {
      return migrate({ ...EMPTY, ...JSON.parse(await fs.readFile(this.file, "utf8")) });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.seeding ??= (async () => {
        const db = this.seed();
        // 실서비스 기본 데이터는 파일로 남기지 않는다(빌드가 만든 파일이 개발 시딩을 막지 않도록).
        if (process.env.NODE_ENV !== "production") await this.save(db);
        return db;
      })().finally(() => {
        this.seeding = null;
      });
      // 같은 객체를 여러 호출자가 고치지 않도록 각자 복사본을 받는다
      return structuredClone(await this.seeding);
    }
  }

  private async save(db: Database) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    // 쓰기마다 다른 임시 파일 (같은 이름을 쓰면 동시에 쓸 때 한쪽 rename이 ENOENT로 실패했다.
    // Next 개발 서버는 여러 작업 프로세스가 같은 파일을 쓸 수 있어서 프로세스 안 큐만으로는 못 막는다)
    const tmp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
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

/** 예전 형식 데이터 호환: works[].images(문자열 배열) → works[].media */
export function migrate(db: Database): Database {
  if (db.categories.length === 0) db.categories = structuredClone(DEFAULT_CATEGORIES);
  db.settings ??= { logoMark: "glass" };
  if (!LOGO_MARKS.includes(db.settings.logoMark)) db.settings.logoMark = "glass";
  if (db.artistGroups.length === 0) db.artistGroups = structuredClone(DEFAULT_ARTIST_GROUPS);
  for (const a of db.artists) {
    a.avatar ??= null;
    a.studio ??= [];
    a.birthYear ??= null;
    a.deathYear ??= null;
    a.estate ??= null;
  }
  for (const o of db.orders) {
    for (const i of o.items) {
      i.seller ??= null;
      i.certificateRequestedAt ??= null;
    }
  }
  for (const w of db.works) {
    w.story ??= [];
    w.consignor ??= null;
    w.provenance ??= null;
    w.appraisal ??= null;
  }
  for (const w of db.works as Array<Database["works"][number] & { images?: string[] }>) {
    if (!w.media) w.media = (w.images ?? []).map((src) => ({ kind: "image" as const, src }));
    delete w.images;
  }
  return db;
}

/** 예시 데이터는 개발 환경에서만, 실서비스에 가짜 작품이 판매 중으로 뜨면 안 된다. */
function defaultSeed(): Database {
  if (process.env.MAYO_SAMPLE_DATA === "off" || process.env.NODE_ENV === "production") return buildBaseDatabase();
  return buildSampleDatabase();
}


/**
 * Vercel 같은 서버리스에서는 파일시스템이 읽기 전용이라 파일 저장소에 쓸 수 없다.
 * MongoDB가 연결되면 열린다.
 */
export const STORE_READONLY = Boolean(process.env.VERCEL) && !USE_MONGO && !process.env.MAYO_STORE_WRITABLE;
export const READONLY_MESSAGE = "정식 오픈 준비 중이라 지금은 온라인으로 신청을 받지 않아요. 문의는 이메일로 부탁드려요.";

/** 데이터 폴더. 테스트는 MAYO_DATA_DIR로 따로 쓴다. */
export const DATA_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.MAYO_DATA_DIR ?? ".data");

export const store: Store = USE_MONGO
  ? new MongoStore(mongoCollection(), defaultSeed, migrate)
  : new LocalJsonStore(path.join(DATA_DIR, "db.json"));
