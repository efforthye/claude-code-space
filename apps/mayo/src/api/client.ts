// HTTP client for the mayo-api backend.
//
// Base URL: set EXPO_PUBLIC_MAYO_API_URL to point at your API (Expo inlines
// EXPO_PUBLIC_* at build time). Defaults to the home-server on :8001 (richclub
// owns :8000). Note: over plain HTTP the phone must reach that host (home LAN or
// a forwarded port / tunnel); prefer HTTPS in production.

import { getSessionToken } from '@/auth/session';
import { getApiKey } from './api-key';
import { getApiBaseUrl } from './base-url';
import type {
  AdminAuditEntry,
  AdminMetricPoint,
  AdminStats,
  AdminUser,
  AuthUser,
  CreateJobRequest,
  CreditPack,
  DirectorChatRequest,
  DirectorModel,
  DirectorTurn,
  Duration,
  EditRequest,
  ExploreComment,
  ExploreItem,
  ExploreSort,
  Orientation,
  Estimate,
  Health,
  Job,
  ModelProvider,
  Plan,
  PublishRequest,
  PublishResult,
  RetentionPlan,
  RuntimeSettings,
  SessionResult,
  Storage,
  Storyboard,
  StoryboardRequest,
  Tier,
  Video,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getApiKey();
  const session = getSessionToken();
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(session ? { 'X-Mayo-Session': session } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : 'network error');
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Absolute playback URL for a media path, carrying auth in a way browser-native
 * loaders can use: web <video> can't send headers, so a signed-in session rides
 * along as ?s= (the API accepts it as a credential). Native players still get
 * headers from the callers; the query param is harmless there. */
export function mediaUrl(path: string): string {
  const base = `${getApiBaseUrl()}${path}`;
  const session = getSessionToken();
  if (!session) return base;
  return `${base}${path.includes('?') ? '&' : '?'}s=${encodeURIComponent(session)}`;
}

/** Poster-frame URL for a stored video's playback path (server generates and
 * caches the JPEG on first request). Returns null for metadata-only videos. */
export function thumbUrl(playbackPath?: string | null): string | null {
  if (!playbackPath || !playbackPath.startsWith('/v1/media/')) return null;
  return mediaUrl(playbackPath.replace('/v1/media/', '/v1/thumb/'));
}

/** Auth headers for media loaders that take a `headers` option (native RN Image
 * / expo-video). Needed because those requests bypass req() — without this a
 * signed-out device gets 401s on thumbnails. react-native-web ignores headers
 * (the ?s= query param from mediaUrl covers signed-in web instead). */
export function mediaHeaders(): Record<string, string> | undefined {
  const key = getApiKey();
  const session = getSessionToken();
  const h: Record<string, string> = {
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
    ...(session ? { 'X-Mayo-Session': session } : {}),
  };
  return Object.keys(h).length ? h : undefined;
}

// --- Health ---
export const getHealth = () => req<Health>('/health');

// --- Admin console (403 unless the signed-in email is in MAYO_ADMIN_EMAILS;
// the 마이 page uses that 403 as the probe to hide the entry) ---
export const getAdminStats = () => req<AdminStats>('/v1/admin/stats');
export const getAdminUsers = () => req<AdminUser[]>('/v1/admin/users');
export const adminAdjustCredits = (userId: string, delta: number) =>
  req<AdminUser>(`/v1/admin/users/${encodeURIComponent(userId)}/credits`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });
export const adminSetPlan = (userId: string, planId: string) =>
  req<AdminUser>(`/v1/admin/users/${encodeURIComponent(userId)}/plan`, {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
export const adminDeleteExplore = (id: string) =>
  req<{ deleted: boolean }>(`/v1/admin/explore/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getAdminAudit = () => req<AdminAuditEntry[]>('/v1/admin/audit');
export const getAdminTimeseries = () => req<AdminMetricPoint[]>('/v1/admin/timeseries');

// --- Auth (accounts + sessions; session token via X-Mayo-Session) ---
export const authRegister = (email: string, password: string, name?: string) =>
  req<SessionResult>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: name ?? '' }),
  });
export const authLogin = (email: string, password: string) =>
  req<SessionResult>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
// Password reset: /start emails a 6-digit code (501 = server has no mail set
// up); /complete swaps the password and signs the user straight in.
export const resetStart = (email: string) =>
  req<{ ok: boolean }>('/v1/auth/reset/start', { method: 'POST', body: JSON.stringify({ email }) });
export const resetComplete = (email: string, code: string, newPassword: string) =>
  req<SessionResult>('/v1/auth/reset/complete', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
// Server-driven SNS start/poll. `link=true` (signed in) LINKS the provider to
// the current account instead of signing in — poll returns `linked` then.
export type SnsPoll = {
  status: 'pending' | 'ready';
  token?: string | null;
  user?: AuthUser | null;
  linked?: string | null;
};
export const googleLoginStart = (link = false) =>
  req<{ loginId: string; url: string }>(`/v1/auth/google/start${link ? '?link=true' : ''}`, {
    method: 'POST',
  });
export const googleLoginResult = (loginId: string) =>
  req<SnsPoll>(`/v1/auth/google/result?loginId=${encodeURIComponent(loginId)}`);
export const authGoogle = (idToken: string) =>
  req<SessionResult>('/v1/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
// GitHub — same server-driven start/poll flow as Google.
export const githubLoginStart = (link = false) =>
  req<{ loginId: string; url: string }>(`/v1/auth/github/start${link ? '?link=true' : ''}`, {
    method: 'POST',
  });
export const githubLoginResult = (loginId: string) =>
  req<SnsPoll>(`/v1/auth/github/result?loginId=${encodeURIComponent(loginId)}`);
// Apple — the device obtains an identityToken (expo-apple-authentication).
export const authApple = (identityToken: string, name?: string, link = false) =>
  req<SessionResult>('/v1/auth/apple', {
    method: 'POST',
    body: JSON.stringify({ identityToken, name: name ?? '', link }),
  });
export const authMe = () => req<AuthUser>('/v1/auth/me');
// BYOK — per-account provider keys; reads are masked ("…1234"), writes are raw.
export const getMyKeys = () => req<{ keys: Record<string, string> }>('/v1/auth/me/keys');
export const putMyKeys = (keys: { anthropic?: string; gemini?: string; higgsfield?: string }) =>
  req<{ keys: Record<string, string> }>('/v1/auth/me/keys', {
    method: 'PUT',
    body: JSON.stringify(keys),
  });
export const authLogout = () => req<void>('/v1/auth/logout', { method: 'POST' });

// --- Catalog ---
export const getTiers = () => req<Tier[]>('/v1/catalog/tiers');
export const getDurations = () => req<Duration[]>('/v1/catalog/durations');
export const getPlans = () => req<Plan[]>('/v1/catalog/plans');
export const getRetentionPlans = () => req<RetentionPlan[]>('/v1/catalog/retention-plans');
export const getModels = () => req<ModelProvider[]>('/v1/catalog/models');
export const getDirectors = () => req<DirectorModel[]>('/v1/catalog/directors');

// --- Jobs ---
export const listJobs = () => req<Job[]>('/v1/jobs');
export const getJob = (id: string) => req<Job>(`/v1/jobs/${encodeURIComponent(id)}`);
/** A price is not user data: quote works signed out too, via the public mirror.
 *  The authenticated route is tried first because only it knows the caller's
 *  BYOK discount. */
export const estimateJob = (body: CreateJobRequest) =>
  reqPublic<Estimate>('/v1/jobs/estimate', '/v1/public/estimate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const createJob = (body: CreateJobRequest) =>
  req<Job>('/v1/jobs', { method: 'POST', body: JSON.stringify(body) });
// Cancelling a charged job refunds the unrendered share pro-rata (e.g. cancel a
// 6-scene job after 2 scenes → 4/6 of the charge back to the credit balance).
export const deleteJob = (id: string) =>
  req<{ deleted: boolean; refundedCredits: number; credits: number | null }>(
    `/v1/jobs/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
export const retryJob = (id: string) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' });

// --- Director (conversational scenario flow) ---
export const directorChat = (body: DirectorChatRequest) =>
  req<DirectorTurn>('/v1/director/chat', { method: 'POST', body: JSON.stringify(body) });
// Storyboard previews: cheap per-scene stills BEFORE the video job is paid for.
export const createStoryboard = (body: StoryboardRequest) =>
  req<Storyboard>('/v1/director/storyboard', { method: 'POST', body: JSON.stringify(body) });
export const getStoryboard = (id: string) =>
  req<Storyboard>(`/v1/director/storyboard/${encodeURIComponent(id)}`);

// --- Editor ---
export const createEdit = (body: EditRequest) =>
  req<Video>('/v1/edit', { method: 'POST', body: JSON.stringify(body) });

/** Upload a recorded audio track (voiceover/BGM) for an edit; returns its key. */
export async function uploadEditAudio(fileUri: string, mimeType = 'audio/mp4'): Promise<string> {
  const file = await fetch(fileUri);
  const blob = await file.blob();
  const key = getApiKey();
  const session = getSessionToken();
  const res = await fetch(`${getApiBaseUrl()}/v1/edit/audio`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(session ? { 'X-Mayo-Session': session } : {}),
    },
    body: blob,
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return ((await res.json()) as { key: string }).key;
}

// --- Explore (public feed + remix + publish) ---
// Anonymous mayo.im visitors have no key/session — explore READS fall back to
// the open /v1/public mirror on 401 so browsing never requires login.
async function reqPublic<T>(authedPath: string, publicPath: string, init?: RequestInit): Promise<T> {
  try {
    return await req<T>(authedPath, init);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return req<T>(publicPath, init);
    throw e;
  }
}

// --- Staged production (ADR 0020) -----------------------------------------
// Text and stills are free to iterate on; only the clips stage costs money.
// Every one of these returns the whole Job, so the screen always renders from
// one authoritative object rather than patching its own copy.

export const planBeats = (jobId: string, prompt: string) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(jobId)}/beats`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

export const rewriteSegment = (jobId: string, index: number, instruction: string) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(jobId)}/segments/${index}/rewrite`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  });

/** Accepts whatever this segment currently shows — text, still, or clip. */
export const approveSegment = (jobId: string, index: number) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(jobId)}/segments/${index}/approve`, { method: 'POST' });

export const renderStills = (jobId: string) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(jobId)}/stills`, { method: 'POST' });

export const reimageSegment = (jobId: string, index: number) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(jobId)}/segments/${index}/reimage`, { method: 'POST' });

/** The "OK, next" button. 409 when the gate is still closed — show the reason. */
export const advanceStage = (jobId: string) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(jobId)}/advance`, { method: 'POST' });

/**
 * The feed for one lane. `orientation` is not a filter the user opted into so
 * much as a property of the player they are looking at: a vertical pager can
 * only show vertical films.
 */
export const getExplore = (
  sort: ExploreSort = 'popular',
  orientation: Orientation = 'all',
  author = '',
) => {
  const q =
    `sort=${sort}&orientation=${orientation}` +
    (author ? `&author=${encodeURIComponent(author)}` : '');
  return reqPublic<ExploreItem[]>(`/v1/explore?${q}`, `/v1/public/explore?${q}`);
};

// --- Following creators ---
// Server-side, so the list is the same on every device and survives reinstall.
export const getFollowing = () => req<string[]>('/v1/explore/following/list');
export const followAuthor = (author: string) =>
  req<string[]>(`/v1/explore/following/${encodeURIComponent(author)}`, { method: 'POST' });
export const unfollowAuthor = (author: string) =>
  req<string[]>(`/v1/explore/following/${encodeURIComponent(author)}`, { method: 'DELETE' });
/** Fold follows made while signed out into the account, on first sign-in. */
export const mergeFollowing = (authors: string[]) =>
  req<string[]>('/v1/explore/following/merge', {
    method: 'POST',
    body: JSON.stringify(authors),
  });
export const publishToExplore = (videoId: string, prompt: string, promptPublic = false) =>
  req<ExploreItem>('/v1/explore', {
    method: 'POST',
    body: JSON.stringify({ videoId, prompt, promptPublic }),
  });
export const getExploreItem = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}`);
// Public shared-reel endpoints — no account/key needed (explore-published only).
export const getPublicReel = (id: string) =>
  req<ExploreItem>(`/v1/public/reels/${encodeURIComponent(id)}`);
export const publicReelMediaUrl = (id: string) =>
  `${getApiBaseUrl()}/v1/public/media/${encodeURIComponent(id)}`;
/** Poster frame for a published reel — same credential-free route as the
 *  video, so grids render for signed-out visitors too. */
export const publicReelThumbUrl = (id: string) =>
  `${getApiBaseUrl()}/v1/public/thumb/${encodeURIComponent(id)}`;
// Dev helper: fill the feed with generated sample reels (server needs ffmpeg).
export const seedExplore = (clear = false) =>
  req<ExploreItem[]>(`/v1/explore/seed${clear ? '?clear=true' : ''}`, { method: 'POST' });
// Reel impression ping — feeds the popular ranking's `views` signal (ADR 0015).
export const viewExplore = (id: string) =>
  reqPublic<ExploreItem>(
    `/v1/explore/${encodeURIComponent(id)}/view`,
    `/v1/public/explore/${encodeURIComponent(id)}/view`,
    { method: 'POST' },
  );
// Completed watch (played to the end) — completion-rate ranking signal.
export const watchExplore = (id: string) =>
  reqPublic<ExploreItem>(
    `/v1/explore/${encodeURIComponent(id)}/watch`,
    `/v1/public/explore/${encodeURIComponent(id)}/watch`,
    { method: 'POST' },
  );
// Completed external share — the strongest ranking signal.
export const shareExplore = (id: string) =>
  reqPublic<ExploreItem>(
    `/v1/explore/${encodeURIComponent(id)}/share`,
    `/v1/public/explore/${encodeURIComponent(id)}/share`,
    { method: 'POST' },
  );
// My posts (owner-only management): list mine incl. hidden, hide/unhide, delete.
export const listMyExplore = () => req<ExploreItem[]>('/v1/explore/mine');
export const hideExplore = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}/hide`, { method: 'POST' });
export const unhideExplore = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}/unhide`, { method: 'POST' });
export const deleteMyExplore = (id: string) =>
  req<{ deleted: boolean }>(`/v1/explore/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const likeExplore = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}/like`, { method: 'POST' });
export const unlikeExplore = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}/unlike`, { method: 'POST' });
export const getComments = (id: string) =>
  reqPublic<ExploreComment[]>(
    `/v1/explore/${encodeURIComponent(id)}/comments`,
    `/v1/public/explore/${encodeURIComponent(id)}/comments`,
  );
export const addComment = (id: string, text: string) =>
  req<ExploreComment>(`/v1/explore/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

// --- Billing (web card payments via Stripe Checkout) ---
export const startCheckout = (planId: string) =>
  req<{ url: string }>('/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ planId }) });
// One-time credit packs (no subscription needed) — list + card checkout.
export const getCreditPacks = () => req<CreditPack[]>('/v1/billing/packs');
export const startPackCheckout = (packId: string) =>
  req<{ url: string }>('/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ packId }) });

// --- YouTube publish (per-user OAuth) ---
export const youtubeStatus = () =>
  req<{ configured: boolean; connected: boolean }>('/v1/publish/youtube/status');
export const youtubeConnect = () =>
  req<{ url: string }>('/v1/publish/youtube/connect', { method: 'POST' });

// --- Runtime settings (app-controlled generation mode) ---
export const getSettings = () => req<RuntimeSettings>('/v1/settings');
export const putSettings = (body: RuntimeSettings) =>
  req<RuntimeSettings>('/v1/settings', { method: 'PUT', body: JSON.stringify(body) });

// --- Library ---
export const listVideos = () => req<Video[]>('/v1/library/videos');
export const getVideo = (id: string) => req<Video>(`/v1/library/videos/${encodeURIComponent(id)}`);
export const getStorage = () => req<Storage>('/v1/library/storage');
export const deleteVideo = (id: string) =>
  req<void>(`/v1/library/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const extendVideo = (id: string, plan: string) =>
  req<Video>(`/v1/library/videos/${encodeURIComponent(id)}/extend`, {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
export const publishVideo = (id: string, body: PublishRequest) =>
  req<PublishResult>(`/v1/library/videos/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
