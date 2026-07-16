// Runtime API base URL. Defaults to EXPO_PUBLIC_MAYO_API_URL (or the home
// server on :8001), but can be overridden at runtime from the Account screen —
// so the app can point at a public tunnel URL and reach the backend from
// anywhere (office / 5G), without an app rebuild. The chosen value is persisted
// by the Settings store and applied here on launch.

// Default to the stable Cloudflare-tunnel address so the app reaches the backend
// from anywhere (office / 5G) with no config. Override at build time with
// EXPO_PUBLIC_MAYO_API_URL, or at runtime from Account → Server (e.g. the LAN
// http://localhost:8001 when developing on the mini directly).
const DEFAULT = (process.env.EXPO_PUBLIC_MAYO_API_URL ?? 'https://mayo-api.efforthye.dev').replace(
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
