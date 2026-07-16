// HTTP client for the mayo-api backend.
//
// Base URL: set EXPO_PUBLIC_MAYO_API_URL to point at your API (Expo inlines
// EXPO_PUBLIC_* at build time). Defaults to the home-server on :8001 (richclub
// owns :8000). Note: over plain HTTP the phone must reach that host (home LAN or
// a forwarded port / tunnel); prefer HTTPS in production.

import { getApiKey } from './api-key';
import { getApiBaseUrl } from './base-url';
import type {
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
  Storage,
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
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
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

// --- Health ---
export const getHealth = () => req<Health>('/health');

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
export const deleteJob = (id: string) =>
  req<void>(`/v1/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const retryJob = (id: string) =>
  req<Job>(`/v1/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' });

// --- Director (conversational scenario flow) ---
export const directorChat = (body: DirectorChatRequest) =>
  req<DirectorTurn>('/v1/director/chat', { method: 'POST', body: JSON.stringify(body) });

// --- Editor ---
export const createEdit = (body: EditRequest) =>
  req<Video>('/v1/edit', { method: 'POST', body: JSON.stringify(body) });

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
