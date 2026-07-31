// Static catalog fallback + pure helpers.
//
// The catalog (tiers, durations, plans, retention plans) is stable config that
// mirrors the server's /v1/catalog/* endpoints. We bundle it so forms render
// instantly and still work if the API is briefly unreachable; useCatalog()
// refreshes it from the server in the background.

import { useEffect, useState } from 'react';

import { getDurations, getPlans, getRetentionPlans, getTiers } from './client';
import type { CreditPack, Duration, Plan, RetentionPlan, Tier } from './types';

export const TIERS: Tier[] = [
  { id: 'draft', label: 'Draft', blurb: 'Fastest, cheapest models — good for rough cuts.', pricePerMin: 6 },
  { id: 'standard', label: 'Standard', blurb: 'Balanced quality and cost.', pricePerMin: 14 },
  { id: 'premium', label: 'Premium', blurb: 'Best image + video models — film-grade output.', pricePerMin: 30 },
];

export const DURATIONS: Duration[] = [
  { id: 's10', label: '10 sec', seconds: 10 },
  { id: 's30', label: '30 sec', seconds: 30 },
  { id: 'm1', label: '1 min', seconds: 60 },
  { id: 'm3', label: '3 min', seconds: 180 },
  { id: 'm10', label: '10 min', seconds: 600 },
  { id: 'm30', label: '30 min', seconds: 1800 },
  { id: 'h1', label: '1 hr+', seconds: 3600 },
];

export const PLANS: Plan[] = [
  { id: 'free', monthly: 0, storageMb: 300 },
  { id: 'pro', monthly: 24, storageMb: 5_000, monthlyCredits: 150 },
  { id: 'studio', monthly: 59, storageMb: 50_000, monthlyCredits: 380 },
];

// One-time credit packs (no subscription needed) — mirrors the server catalog.
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack100', credits: 100, usd: 18 },
  { id: 'pack300', credits: 300, usd: 50 },
  { id: 'pack1000', credits: 1_000, usd: 160 },
];

/** Storage allowance (bytes) for a plan; falls back to the free-tier 300 MB. */
export function planStorageBytes(planId: string, plans: Plan[] = PLANS): number {
  const mb = plans.find((p) => p.id === planId)?.storageMb ?? 300;
  return mb * 1024 * 1024;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export const RETENTION_PLANS: RetentionPlan[] = [
  { id: 'd7', days: 7, credits: 20 },
  { id: 'd30', days: 30, credits: 60 },
  { id: 'forever', days: 0, credits: 200 },
];

// The signed-in user's current plan. No auth yet, so this is local; it becomes
// server-driven once accounts + billing land.
export const CURRENT_PLAN_ID = 'pro';

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const totalMin = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (totalMin < 60) return s ? `${totalMin}m ${s}s` : `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h} hr`;
}

export function estimateCredits(seconds: number, tier: Tier): number {
  return Math.max(1, Math.round((seconds / 60) * tier.pricePerMin));
}

type Catalog = { tiers: Tier[]; durations: Duration[]; plans: Plan[]; retentionPlans: RetentionPlan[] };

/** Catalog seeded from the bundled fallback, refreshed from the API in the background. */
export function useCatalog(): Catalog {
  const [catalog, setCatalog] = useState<Catalog>({
    tiers: TIERS,
    durations: DURATIONS,
    plans: PLANS,
    retentionPlans: RETENTION_PLANS,
  });

  useEffect(() => {
    let alive = true;
    Promise.all([getTiers(), getDurations(), getPlans(), getRetentionPlans()])
      .then(([tiers, durations, plans, retentionPlans]) => {
        if (alive) setCatalog({ tiers, durations, plans, retentionPlans });
      })
      .catch(() => {
        // keep the bundled fallback on error
      });
    return () => {
      alive = false;
    };
  }, []);

  return catalog;
}
