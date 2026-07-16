// Mock data for the mayo app shell (UI only — no backend yet).

export type Duration = { id: string; label: string; seconds: number };
export const DURATIONS: Duration[] = [
  { id: 's10', label: '10 sec', seconds: 10 },
  { id: 's30', label: '30 sec', seconds: 30 },
  { id: 'm1', label: '1 min', seconds: 60 },
  { id: 'm3', label: '3 min', seconds: 180 },
  { id: 'm10', label: '10 min', seconds: 600 },
  { id: 'm30', label: '30 min', seconds: 1800 },
  { id: 'h1', label: '1 hr+', seconds: 3600 },
];

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const totalMin = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (totalMin < 60) return s ? `${totalMin}m ${s}s` : `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h} hr`;
}

export type Tier = { id: string; label: string; blurb: string; pricePerMin: number };
export const TIERS: Tier[] = [
  { id: 'draft', label: 'Draft', blurb: 'Fastest, cheapest models — good for rough cuts.', pricePerMin: 6 },
  { id: 'standard', label: 'Standard', blurb: 'Balanced quality and cost.', pricePerMin: 14 },
  { id: 'premium', label: 'Premium', blurb: 'Best image + video models — film-grade output.', pricePerMin: 30 },
];

export function estimateCredits(seconds: number, tier: Tier): number {
  return Math.max(1, Math.round((seconds / 60) * tier.pricePerMin));
}

export type JobStatus = 'queued' | 'generating' | 'done' | 'failed';
export type Job = {
  id: string;
  title: string;
  status: JobStatus;
  scenesDone: number;
  scenesTotal: number;
  etaMin?: number;
};
export const JOBS: Job[] = [
  { id: 'j1', title: 'Lighthouse keeper — cinematic short', status: 'generating', scenesDone: 7, scenesTotal: 18, etaMin: 12 },
  { id: 'j2', title: 'Neon city chase (30 min)', status: 'queued', scenesDone: 0, scenesTotal: 92 },
  { id: 'j3', title: 'Product teaser — 3 min', status: 'done', scenesDone: 9, scenesTotal: 9 },
  { id: 'j4', title: 'Documentary intro', status: 'failed', scenesDone: 3, scenesTotal: 20 },
];
export function jobStatusLabel(s: JobStatus): string {
  return { queued: 'Queued', generating: 'Generating', done: 'Done', failed: 'Failed' }[s];
}

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
export const VIDEOS: Video[] = [
  { id: 'v1', title: 'Product teaser — 3 min', durationLabel: '3:02', sizeLabel: '480 MB', expiresInDays: 11, accent: '#6D5DF6', resolution: '1080p', tierLabel: 'Premium', scenes: 9, createdLabel: '3 days ago' },
  { id: 'v2', title: 'Ocean documentary cut', durationLabel: '28:14', sizeLabel: '3.9 GB', expiresInDays: 3, accent: '#1FA2A6', resolution: '1080p', tierLabel: 'Standard', scenes: 64, createdLabel: '1 week ago' },
  { id: 'v3', title: 'Wedding recap film', durationLabel: '12:41', sizeLabel: '1.6 GB', expiresInDays: 1, accent: '#E0699A', resolution: '4K', tierLabel: 'Premium', scenes: 31, createdLabel: '2 weeks ago' },
];

export function getVideo(id: string): Video | undefined {
  return VIDEOS.find((v) => v.id === id);
}

// Retention extension plans (UI-only). days === 0 means keep indefinitely.
export type RetentionPlan = { id: string; days: number; credits: number };
export const RETENTION_PLANS: RetentionPlan[] = [
  { id: 'd7', days: 7, credits: 20 },
  { id: 'd30', days: 30, credits: 60 },
  { id: 'forever', days: 0, credits: 200 },
];

export const STORAGE = { usedLabel: '18.2 GB', totalLabel: '50 GB', usedRatio: 0.36 };

// Subscription plans (UI-only). monthly === 0 is the free tier.
export type Plan = { id: string; monthly: number };
export const PLANS: Plan[] = [
  { id: 'free', monthly: 0 },
  { id: 'pro', monthly: 19 },
  { id: 'studio', monthly: 49 },
];
export const CURRENT_PLAN_ID = 'pro';
