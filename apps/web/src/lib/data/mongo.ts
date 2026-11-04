import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * MongoDB 연결 한 곳. 데이터 저장(store), 요청 제한(rate-limit), 비공개 서류(uploads)가 같이 쓴다.
 * 테스트는 MAYO_DATA_DIR로 파일 저장소를 쓰므로 실제 DB를 건드리지 않는다.
 */
export const USE_MONGO = Boolean(process.env.MONGODB_URI) && !process.env.MAYO_DATA_DIR;

let client: Promise<MongoClient> | null = null;

/** 프로세스당 연결 하나 (서버리스에서 요청마다 새로 연결하지 않도록) */
export async function mongoDb(): Promise<Db> {
  if (!USE_MONGO) throw new Error("MongoDB is not configured");
  client ??= new MongoClient(process.env.MONGODB_URI!, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
  return (await client).db(process.env.MONGODB_DB ?? "mayo");
}

/** 컬렉션에 한 번만 인덱스를 만든다 (TTL 등) */
const ensured = new Set<string>();
export async function ensureIndex(collection: string, spec: Record<string, 1 | -1>, options: { expireAfterSeconds?: number; name: string }) {
  const key = `${collection}:${options.name}`;
  if (ensured.has(key)) return;
  ensured.add(key);
  await (await mongoDb()).collection(collection).createIndex(spec, options).catch(() => ensured.delete(key));
}
