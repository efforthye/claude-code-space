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
  AuthUser,
  CreateJobRequest,
  DirectorChatRequest,
  DirectorModel,
  DirectorTurn,
  Duration,
  EditRequest,
  ExploreComment,
  ExploreItem,
  ExploreSort,
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

// --- Auth (accounts + sessions; session token via X-Mayo-Session) ---
export const authRegister = (email: string, password: string, name?: string) =>
  req<SessionResult>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: name ?? '' }),
  });
export const authLogin = (email: string, password: string) =>
  req<SessionResult>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const googleLoginStart = () =>
  req<{ loginId: string; url: string }>('/v1/auth/google/start', { method: 'POST' });
export const googleLoginResult = (loginId: string) =>
  req<{ status: 'pending' | 'ready'; token?: string | null; user?: AuthUser | null }>(
    `/v1/auth/google/result?loginId=${encodeURIComponent(loginId)}`,
  );
export const authGoogle = (idToken: string) =>
  req<SessionResult>('/v1/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
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
export const estimateJob = (body: CreateJobRequest) =>
  req<Estimate>('/v1/jobs/estimate', { method: 'POST', body: JSON.stringify(body) });
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
export const getExplore = (sort: ExploreSort = 'popular') =>
  req<ExploreItem[]>(`/v1/explore?sort=${sort}`);
export const publishToExplore = (videoId: string, prompt: string) =>
  req<ExploreItem>('/v1/explore', { method: 'POST', body: JSON.stringify({ videoId, prompt }) });
export const likeExplore = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}/like`, { method: 'POST' });
export const unlikeExplore = (id: string) =>
  req<ExploreItem>(`/v1/explore/${encodeURIComponent(id)}/unlike`, { method: 'POST' });
export const getComments = (id: string) =>
  req<ExploreComment[]>(`/v1/explore/${encodeURIComponent(id)}/comments`);
export const addComment = (id: string, text: string) =>
  req<ExploreComment>(`/v1/explore/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

// --- Billing (web card payments via Stripe Checkout) ---
export const startCheckout = (planId: string) =>
  req<{ url: string }>('/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ planId }) });

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
