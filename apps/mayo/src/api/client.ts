// HTTP client for the mayo-api backend.
//
// Base URL: set EXPO_PUBLIC_MAYO_API_URL to point at your API (Expo inlines
// EXPO_PUBLIC_* at build time). Defaults to the home-server on :8001 (richclub
// owns :8000). Note: over plain HTTP the phone must reach that host (home LAN or
// a forwarded port / tunnel); prefer HTTPS in production.

import { getApiBaseUrl } from './base-url';
import type {
  CreateJobRequest,
  Duration,
  Estimate,
  Health,
  Job,
  ModelProvider,
  Plan,
  PublishRequest,
  PublishResult,
  RetentionPlan,
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
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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

// --- Jobs ---
export const listJobs = () => req<Job[]>('/v1/jobs');
export const getJob = (id: string) => req<Job>(`/v1/jobs/${encodeURIComponent(id)}`);
export const estimateJob = (body: CreateJobRequest) =>
  req<Estimate>('/v1/jobs/estimate', { method: 'POST', body: JSON.stringify(body) });
export const createJob = (body: CreateJobRequest) =>
  req<Job>('/v1/jobs', { method: 'POST', body: JSON.stringify(body) });
export const deleteJob = (id: string) =>
  req<void>(`/v1/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });

// --- Library ---
export const listVideos = () => req<Video[]>('/v1/library/videos');
export const getVideo = (id: string) => req<Video>(`/v1/library/videos/${encodeURIComponent(id)}`);
export const getStorage = () => req<Storage>('/v1/library/storage');
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
