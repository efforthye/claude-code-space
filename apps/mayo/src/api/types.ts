// Wire types for the mayo-api backend. These mirror the FastAPI schemas in
// apps/mayo-api/app/schemas.py exactly.

export type JobStatus = 'queued' | 'generating' | 'done' | 'failed';
export type Visibility = 'private' | 'unlisted' | 'public';
export type ModelKind = 'image' | 'video';

export type Tier = { id: string; label: string; blurb: string; pricePerMin: number };
export type Duration = { id: string; label: string; seconds: number };
export type Plan = { id: string; monthly: number };
export type RetentionPlan = { id: string; days: number; credits: number };
export type ModelProvider = { id: string; name: string; kind: ModelKind; tier: string; blurb: string };

export type Job = {
  id: string;
  title: string;
  status: JobStatus;
  scenesDone: number;
  scenesTotal: number;
  etaMin?: number | null;
  tierLabel?: string | null;
  seconds?: number | null;
};

export type Video = {
  id: string;
  title: string;
  durationLabel: string;
  sizeLabel: string;
  expiresInDays: number;
  accent: string;
  resolution: string;
  tierLabel: string;
  scenes: number;
  createdLabel: string;
};

export type Storage = { usedLabel: string; totalLabel: string; usedRatio: number };
export type Estimate = { seconds: number; tier: string; credits: number };

export type CreateJobRequest = { prompt: string; seconds: number; tier: string };
export type PublishRequest = { title: string; description?: string; visibility: Visibility };
export type PublishResult = { accepted: boolean; videoId: string; visibility: Visibility };
