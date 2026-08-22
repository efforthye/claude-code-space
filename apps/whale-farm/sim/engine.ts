// WHALE FARM — the economy engine (v0.2: the engine-building rewrite).
//
// v0.1 was an honest simulation and a boring game: four monotonic sliders, cards
// that never touched each other, twelve identical turns. v0.2 puts the fun in
// three named places:
//
//   1. BUILD — persistent policies occupy 4 slots. Policies sharing a tag amplify
//      each other MULTIPLICATIVELY, and each named whale pays extra for the tags
//      they personally care about. Your board decides who funds the quarter.
//   2. PUSH — after committing the week you may press your luck up to 3 times.
//      Escalating reward, escalating chance of an incident.
//   3. COST — whales are seven named people with finite wallets and finite
//      patience. A big engine can drain one in two weeks, and then they are gone
//      for the rest of the run. Total whale wallets are the hard ceiling on the
//      quarter, so extraction is a resource puzzle, not a slider.
//
// Deterministic given (seed, decisions). montecarlo.ts is the judge of balance.

import { makeRng, type Rng } from './rng.ts';
import { CARD_BY_ID, deckForTier } from './cards.ts';
import { newWhales, WHALE_AFFINITY } from './whales.ts';
import {
  COHORTS,
  SLOTS,
  type ActiveEffect,
  type Card,
  type CardMods,
  type Cohort,
  type CohortId,
  type Dials,
  type RunConfig,
  type RunState,
  type WeekLog,
  type Whale,
} from './types.ts';

// ── Tuning constants ────────────────────────────────────────────────────────────

export const NEUTRAL_DIALS: Dials = {
  gachaRatePct: 0.8,
  priceMult: 1.0,
  energyTightness: 0.35,
  adFreq: 0,
};

const MIX: Record<CohortId, number> = { whale: 0.002, dolphin: 0.03, fish: 0.2, f2p: 0.768 };
const CONV: Record<CohortId, number> = { whale: 0, dolphin: 0.35, fish: 0.06, f2p: 0 };
const ARPPU: Record<CohortId, number> = { whale: 0, dolphin: 9, fish: 1.6, f2p: 0 };
const VISIBILITY: Record<CohortId, number> = { whale: 0.6, dolphin: 0.9, fish: 1.0, f2p: 1.35 };
const CHURN: Record<CohortId, number> = { whale: 0.02, dolphin: 0.03, fish: 0.05, f2p: 0.06 };
const EXPLOIT_ELASTICITY: Record<CohortId, number> = { whale: 0, dolphin: 0.18, fish: -0.3, f2p: 0 };

const TRUST_DECAY_PER_EXPLOIT = 9.5;
const TRUST_RECOVERY = 1.3;
const BACKLASH_PER_EXPLOIT = 11;
const BACKLASH_DECAY = 6;
const OUTRAGE_THRESHOLD = 100;
const FIRED_THRESHOLD = 145;
const BASE_ORGANIC_INSTALLS = 18000;
const AD_ARPU_WEEKLY = 0.014;

const NOVELTY_DECAY = 0.85;
const NOVELTY_FLOOR = 0.45;
const NOVELTY_CEIL = 1.05;
const CONTENT_TAGS = new Set(['gacha', 'cosmetic', 'revenue', 'retention', 'p2w', 'vip', 'pricing', 'pvp']);
const NOVELTY_GAIN_CONTENT = 0.14;
const NOVELTY_GAIN_OTHER = 0.03;

/** base weekly extraction per active whale before any multiplier */
const WHALE_BASE = 11_000;
/** multiplier per board policy a whale personally cares about — this is the build */
const AFFINITY_MULT = 1.35;
/** synergy per matching tag pair on the board */
const SYNERGY_PER_PAIR = 0.14;
const SYNERGY_CAP = 2.4;
/** patience burn per unit of exploitation, scaled by (1 - personal tolerance) */
const PATIENCE_BURN = 13;

/** press-your-luck: revenue multiplier and per-push incident odds */
export const PUSH_MULT = [1, 1.14, 1.34, 1.62];
export const PUSH_RISK = [0, 0.13, 0.26, 0.39];
export const MAX_PUSH = 3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Dials are a seasonal commitment, not weekly fiddling: weeks 1, 5, 9. */
export function isSeasonStart(week: number): boolean {
  return week % 4 === 1;
}

// ── Run setup ───────────────────────────────────────────────────────────────────

export function defaultConfig(seed: number): RunConfig {
  return { seed, target: 2_600_000, weeks: 12, startingMau: 500_000 };
}

export function newRun(cfg: RunConfig, maxTier: 1 | 2 | 3 = 3): RunState {
  const cohorts = {} as Record<CohortId, Cohort>;
  for (const id of COHORTS) {
    cohorts[id] = { id, pop: Math.round(cfg.startingMau * MIX[id]), trust: 72, lastRevenue: 0 };
  }
  const state: RunState = {
    cfg,
    week: 1,
    cohorts,
    whales: newWhales(),
    dials: { ...NEUTRAL_DIALS },
    effects: [],
    revenue: 0,
    rating: 4.3,
    backlash: 8,
    novelty: 1.0,
    status: 'running',
    log: [],
    offer: [],
    outrageCount: 0,
    totalPushes: 0,
    incidents: 0,
    deck: deckForTier(maxTier),
  };
  state.offer = drawOffer(state, makeRng(cfg.seed ^ 0x9e3779b9));
  return state;
}

export function drawOffer(state: RunState, rng: Rng): string[] {
  const p = state.revenue / (state.cfg.target * (state.week / state.cfg.weeks) || 1);
  const behind = p < 0.9;
  const pool = state.deck.filter((id) => {
    const c = CARD_BY_ID[id];
    if (behind) return true;
    return !(c.tier === 3 && c.tags.includes('dark-pattern')) || rng.chance(0.4);
  });
  return rng.sample(pool, Math.min(3, pool.length));
}

// ── Board: the build ────────────────────────────────────────────────────────────

export function board(state: RunState): ActiveEffect[] {
  return state.effects.filter((e) => e.slot);
}

/**
 * Tag pairs on the board amplify each other. Four gacha policies running at once
 * is six pairs, which is where the numbers start to get silly — and where the
 * backlash does too.
 */
export function synergyMult(effects: ActiveEffect[]): number {
  const counts = new Map<string, number>();
  for (const e of effects) {
    if (!e.slot) continue;
    for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let pairs = 0;
  for (const n of counts.values()) pairs += (n * (n - 1)) / 2;
  return Math.min(SYNERGY_CAP, 1 + SYNERGY_PER_PAIR * pairs);
}

/** How many board policies this particular whale personally pays extra for. */
export function affinityHits(whale: Whale, effects: ActiveEffect[]): number {
  const want = WHALE_AFFINITY[whale.id] ?? [];
  let n = 0;
  for (const e of effects) {
    if (!e.slot) continue;
    if (e.tags.some((t) => want.includes(t))) n++;
  }
  return n;
}

export function exploitIntensity(dials: Dials, effects: ActiveEffect[]): number {
  const gachaPressure = clamp((NEUTRAL_DIALS.gachaRatePct - dials.gachaRatePct) / 0.6, -1.4, 1.2);
  const pricePressure = clamp((dials.priceMult - 1) / 0.5, -0.4, 1);
  const energyPressure = clamp((dials.energyTightness - NEUTRAL_DIALS.energyTightness) / 0.65, -0.5, 1);
  const dialPart = 0.5 * gachaPressure + 0.18 * pricePressure + 0.2 * energyPressure + 0.12 * dials.adFreq;
  const cardPart = effects.reduce((s, e) => s + (e.mods.exploit ?? 0), 0);
  return clamp(dialPart + cardPart, -1, 2.2);
}

// ── One week ────────────────────────────────────────────────────────────────────

export interface WeekDecision {
  card: string | null;
  /** board policy to evict when all slots are full */
  evict?: string | null;
  /** 0..3 — press your luck */
  pushes?: number;
  /** honoured only on season starts (weeks 1, 5, 9) */
  dials?: Partial<Dials>;
}

export function advanceWeek(state: RunState, decision: WeekDecision): RunState {
  if (state.status !== 'running') return state;

  const rng = makeRng(state.cfg.seed + state.week * 7919);
  const events: string[] = [];
  const whalesLost: string[] = [];
  const pushes = clamp(Math.round(decision.pushes ?? 0), 0, MAX_PUSH);

  // 1) decisions
  if (decision.dials && isSeasonStart(state.week)) {
    state.dials = {
      gachaRatePct: clamp(decision.dials.gachaRatePct ?? state.dials.gachaRatePct, 0.2, 2.0),
      priceMult: clamp(decision.dials.priceMult ?? state.dials.priceMult, 0.8, 1.5),
      energyTightness: clamp(decision.dials.energyTightness ?? state.dials.energyTightness, 0, 1),
      adFreq: clamp(decision.dials.adFreq ?? state.dials.adFreq, 0, 1),
    };
  }

  let playedCard: Card | null = null;
  if (decision.card && state.offer.includes(decision.card)) {
    playedCard = CARD_BY_ID[decision.card];
    // multi-week programmes occupy a board slot; one-shots resolve and are gone
    const wantsSlot = playedCard.persistent ?? playedCard.duration > 1;
    if (wantsSlot && board(state).length >= SLOTS) {
      const evictId = decision.evict ?? board(state)[0]?.cardId;
      const i = state.effects.findIndex((e) => e.slot && e.cardId === evictId);
      if (i >= 0) {
        events.push(`evict:${state.effects[i].cardId}`);
        state.effects.splice(i, 1);
      }
    }
    state.effects.push({
      cardId: playedCard.id,
      label: playedCard.name,
      weeksLeft: playedCard.duration,
      mods: playedCard.mods,
      tags: playedCard.tags,
      slot: wantsSlot,
    });
    applyOneShot(state, playedCard.mods);
    events.push(`played:${playedCard.id}`);
  }

  // 2) aggregate modifiers
  const exploit = exploitIntensity(state.dials, state.effects);
  const synergy = synergyMult(state.effects);
  const revMult = {} as Record<CohortId, number>;
  for (const id of COHORTS) revMult[id] = 1;
  let acquisitionMult = 1;
  let churnMult = 1;
  let cash = 0;

  for (const eff of state.effects) {
    const m = eff.mods;
    if (m.revenueMult) for (const id of COHORTS) revMult[id] *= m.revenueMult[id] ?? 1;
    if (m.acquisitionMult) acquisitionMult *= m.acquisitionMult;
    if (m.churnMult) churnMult *= m.churnMult;
    if (m.cash) cash += m.cash;
    if (m.trustDrift) for (const id of COHORTS) state.cohorts[id].trust += m.trustDrift[id] ?? 0;
    if (m.leakChance && rng.chance(m.leakChance)) {
      state.backlash += 34;
      state.rating -= 0.35;
      for (const id of COHORTS) state.cohorts[id].trust -= 9 * VISIBILITY[id];
      for (const w of state.whales) w.patience -= 7 * (1 - w.tolerance);
      events.push(`leak:${eff.cardId}`);
    }
  }

  // 3) press your luck — resolved before revenue so the reward is real
  const pushMult = PUSH_MULT[pushes];
  for (let i = 1; i <= pushes; i++) {
    state.totalPushes++;
    if (rng.chance(PUSH_RISK[i])) {
      state.incidents++;
      state.backlash += 26;
      state.rating = clamp(state.rating - 0.25, 1, 5);
      for (const w of state.whales) w.patience -= 6 * (1 - w.tolerance);
      events.push('incident');
      break; // the first one that lands ends the week's luck
    }
  }

  // 4) novelty
  const gain = playedCard
    ? playedCard.tags.some((t) => CONTENT_TAGS.has(t))
      ? NOVELTY_GAIN_CONTENT
      : NOVELTY_GAIN_OTHER
    : 0;
  state.novelty = clamp(state.novelty * NOVELTY_DECAY + gain, NOVELTY_FLOOR, NOVELTY_CEIL);

  // 5) revenue — the whales are individuals now
  let weekRevenue = cash;
  let whaleRevenue = 0;
  for (const w of state.whales) {
    w.lastSpend = 0;
    if (w.status !== 'active') continue;
    const aff = Math.pow(AFFINITY_MULT, affinityHits(w, state.effects));
    const want =
      WHALE_BASE *
      (1 + 0.55 * exploit) *
      Math.pow(clamp(w.patience, 0, 100) / 82, 0.6) *
      state.novelty *
      synergy *
      aff *
      revMult.whale *
      pushMult;
    const spend = Math.max(0, Math.min(want, w.wallet));
    w.wallet -= spend;
    w.spent += spend;
    w.lastSpend = spend;
    whaleRevenue += spend;
    if (w.wallet <= 1) {
      w.status = 'broke';
      w.leftWeek = state.week;
      whalesLost.push(w.name);
      events.push(`broke:${w.id}`);
    }
  }
  state.cohorts.whale.lastRevenue = whaleRevenue;
  weekRevenue += whaleRevenue;

  for (const id of COHORTS) {
    if (id === 'whale') continue;
    const c = state.cohorts[id];
    if (id === 'f2p') {
      const adRev = c.pop * state.dials.adFreq * AD_ARPU_WEEKLY;
      c.lastRevenue = adRev;
      weekRevenue += adRev;
      continue;
    }
    const trustFactor = Math.pow(clamp(c.trust, 0, 100) / 72, 0.55);
    const exploitFactor = 1 + EXPLOIT_ELASTICITY[id] * exploit;
    const softCap = id === 'dolphin' ? 1 - 0.12 * Math.max(0, exploit) ** 2 : 1;
    const rev =
      c.pop * CONV[id] * ARPPU[id] * state.dials.priceMult *
      Math.max(0, exploitFactor) * softCap * trustFactor * state.novelty *
      Math.min(synergy, 1.5) * revMult[id] * pushMult;
    c.lastRevenue = rev;
    weekRevenue += rev;
  }
  weekRevenue = Math.max(0, weekRevenue);
  state.revenue += weekRevenue;

  // 6) patience, trust, backlash, rating
  for (const w of state.whales) {
    if (w.status !== 'active') continue;
    const burn = Math.max(0, exploit) * PATIENCE_BURN * (1 - w.tolerance) + pushes * 1.4 * (1 - w.tolerance);
    w.patience = clamp(w.patience - burn + (exploit <= 0 ? 2.5 : 0.4), 0, 100);
    if (w.patience <= 0) {
      w.status = 'lapsed';
      w.leftWeek = state.week;
      whalesLost.push(w.name);
      events.push(`lapsed:${w.id}`);
    }
  }

  for (const id of COHORTS) {
    const c = state.cohorts[id];
    const damage = Math.max(0, exploit) * TRUST_DECAY_PER_EXPLOIT * VISIBILITY[id];
    const gift = Math.max(0, -exploit) * 6 * VISIBILITY[id];
    c.trust = clamp(c.trust - damage + gift + TRUST_RECOVERY, 0, 100);
  }

  state.backlash = Math.max(0, state.backlash + Math.max(0, exploit) * BACKLASH_PER_EXPLOIT - BACKLASH_DECAY);

  const weightedTrust =
    COHORTS.reduce((s, id) => s + state.cohorts[id].trust * state.cohorts[id].pop, 0) /
    Math.max(1, COHORTS.reduce((s, id) => s + state.cohorts[id].pop, 0));
  const ratingTarget = clamp(1.6 + 3.4 * (weightedTrust / 100), 1, 5);
  state.rating = clamp(state.rating + (ratingTarget - state.rating) * 0.28, 1, 5);

  if (state.backlash >= OUTRAGE_THRESHOLD && state.outrageCount < 3) {
    state.outrageCount++;
    state.rating = clamp(state.rating - 1.15, 1, 5);
    for (const id of COHORTS) state.cohorts[id].trust = clamp(state.cohorts[id].trust - 12 * VISIBILITY[id], 0, 100);
    for (const w of state.whales) w.patience = clamp(w.patience - 14 * (1 - w.tolerance), 0, 100);
    acquisitionMult *= 0.25;
    events.push('outrage');
  }

  // 7) churn and acquisition
  for (const id of COHORTS) {
    const c = state.cohorts[id];
    const churn =
      CHURN[id] * (1 + 1.5 * Math.max(0, exploit)) *
      (1 + (1 - clamp(c.trust, 0, 100) / 100) * 1.7) * churnMult;
    c.pop = Math.max(0, Math.round(c.pop * (1 - clamp(churn, 0, 0.6))));
  }
  const installs =
    BASE_ORGANIC_INSTALLS *
    Math.pow(clamp(state.rating, 1, 5) / 4.3, 2.2) *
    clamp(1 - state.backlash / 150, 0.05, 1) *
    clamp(state.cohorts.f2p.trust / 70, 0.1, 1.15) *
    (0.55 + 0.45 * state.novelty) *
    acquisitionMult;
  for (const id of COHORTS) state.cohorts[id].pop += Math.round(installs * MIX[id]);

  // 8) tick effects
  state.effects = state.effects.map((e) => ({ ...e, weeksLeft: e.weeksLeft - 1 })).filter((e) => e.weeksLeft > 0);

  // 9) log + status
  const mau = COHORTS.reduce((s, id) => s + state.cohorts[id].pop, 0);
  state.log.push({
    week: state.week,
    revenue: weekRevenue,
    cumulative: state.revenue,
    exploit,
    rating: state.rating,
    backlash: state.backlash,
    novelty: state.novelty,
    mau,
    trust: Object.fromEntries(COHORTS.map((id) => [id, state.cohorts[id].trust])) as Record<CohortId, number>,
    cardPlayed: playedCard?.id ?? null,
    pushes,
    synergy,
    whalesLost,
    events,
  } satisfies WeekLog);

  if (state.backlash >= FIRED_THRESHOLD) {
    state.status = 'fired_outrage';
    return state;
  }

  state.week++;
  if (state.week > state.cfg.weeks) {
    state.status = state.revenue >= state.cfg.target ? 'promoted' : 'fired_target';
    return state;
  }

  state.offer = drawOffer(state, makeRng(state.cfg.seed + state.week * 104729));
  return state;
}

function applyOneShot(state: RunState, mods: CardMods) {
  if (mods.trustDelta) {
    for (const id of COHORTS) {
      state.cohorts[id].trust = clamp(state.cohorts[id].trust + (mods.trustDelta[id] ?? 0), 0, 100);
    }
    // whales read the room too: the free-player-facing goodwill also calms them
    const gw = mods.trustDelta.f2p ?? 0;
    for (const w of state.whales) w.patience = clamp(w.patience + gw * 0.45, 0, 100);
  }
  if (mods.backlashDelta) state.backlash = Math.max(0, state.backlash + mods.backlashDelta);
  if (mods.ratingDelta) state.rating = clamp(state.rating + mods.ratingDelta, 1, 5);
}

export function pace(state: RunState): number {
  const expected = state.cfg.target * ((state.week - 1) / state.cfg.weeks);
  return expected <= 0 ? 1 : state.revenue / expected;
}

/** Projected revenue if the player pressed their luck n more times. For the UI. */
export function pushPreview(state: RunState, pushes: number): { mult: number; risk: number } {
  const p = clamp(Math.round(pushes), 0, MAX_PUSH);
  return { mult: PUSH_MULT[p], risk: PUSH_RISK[p] };
}
