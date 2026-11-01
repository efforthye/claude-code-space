// mayo-api(홈서버 FastAPI) 호출의 단일 진입점. 공개 번들에 들어가므로 키·토큰은 절대 넣지 않는다.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://mayo-api.efforthye.dev";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}
