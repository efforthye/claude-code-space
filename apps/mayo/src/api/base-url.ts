// Runtime API base URL. Defaults to EXPO_PUBLIC_MAYO_API_URL (or the home
// server on :8001), but can be overridden at runtime from the Account screen —
// so the app can point at a public tunnel URL and reach the backend from
// anywhere (office / 5G), without an app rebuild. The chosen value is persisted
// by the Settings store and applied here on launch.

const DEFAULT = (process.env.EXPO_PUBLIC_MAYO_API_URL ?? 'http://home.efforthye.com:8001').replace(
  /\/+$/,
  '',
);

let current = DEFAULT;

export const DEFAULT_API_BASE_URL = DEFAULT;

export function getApiBaseUrl(): string {
  return current;
}

export function setApiBaseUrl(url: string | undefined | null): void {
  const trimmed = (url ?? '').trim().replace(/\/+$/, '');
  current = trimmed || DEFAULT;
}
