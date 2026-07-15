// Mock data for the mayo app shell (UI only — no backend yet).

export type Duration = { id: string; label: string; minutes: number };
export const DURATIONS: Duration[] = [
  { id: 'd3', label: '3 min', minutes: 3 },
  { id: 'd10', label: '10 min', minutes: 10 },
  { id: 'd30', label: '30 min', minutes: 30 },
  { id: 'd60', label: '1 hr+', minutes: 60 },
];

export type Tier = { id: string; label: string; blurb: string; pricePerMin: number };
export const TIERS: Tier[] = [
  { id: 'draft', label: 'Draft', blurb: 'Fastest, cheapest models — good for rough cuts.', pricePerMin: 6 },
  { id: 'standard', label: 'Standard', blurb: 'Balanced quality and cost.', pricePerMin: 14 },
  { id: 'premium', label: 'Premium', blurb: 'Best image + video models — film-grade output.', pricePerMin: 30 },
];

export function estimateCredits(minutes: number, tier: Tier): number {
  return Math.round(minutes * tier.pricePerMin);
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
};
export const VIDEOS: Video[] = [
  { id: 'v1', title: 'Product teaser — 3 min', durationLabel: '3:02', sizeLabel: '480 MB', expiresInDays: 11, accent: '#6D5DF6' },
  { id: 'v2', title: 'Ocean documentary cut', durationLabel: '28:14', sizeLabel: '3.9 GB', expiresInDays: 3, accent: '#1FA2A6' },
  { id: 'v3', title: 'Wedding recap film', durationLabel: '12:41', sizeLabel: '1.6 GB', expiresInDays: 1, accent: '#E0699A' },
];

export const STORAGE = { usedLabel: '18.2 GB', totalLabel: '50 GB', usedRatio: 0.36 };
