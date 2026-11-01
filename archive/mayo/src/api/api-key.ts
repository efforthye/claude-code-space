// Runtime API key sent to mayo-api as `Authorization: Bearer <key>`. The API
// requires it on all /v1/* endpoints. The value is a secret and is NOT stored in
// this (public) repo — it's supplied at build time via EXPO_PUBLIC_MAYO_API_KEY,
// or pasted at runtime in Account → API key (persisted by the Settings store).

const DEFAULT = (process.env.EXPO_PUBLIC_MAYO_API_KEY ?? '').trim();

let current = DEFAULT;

export const DEFAULT_API_KEY = DEFAULT;

export function getApiKey(): string {
  return current;
}

export function setApiKey(key: string | undefined | null): void {
  current = (key ?? '').trim();
}
