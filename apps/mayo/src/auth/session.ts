// Per-user session token, sent to mayo-api as `X-Mayo-Session` (separate from
// the shared API key in Authorization). Held module-level so the API client can
// read it synchronously; the AuthProvider persists it in AsyncStorage.

let current = '';

export function getSessionToken(): string {
  return current;
}

export function setSessionToken(token: string | undefined | null): void {
  current = (token ?? '').trim();
}
