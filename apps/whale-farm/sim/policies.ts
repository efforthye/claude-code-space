// WHALE FARM — AI policies used for balancing, not for shipping.
//
// The design thesis is falsifiable: GREEDY should out-earn everyone for six weeks
// and then get fired; BUILDER (which stacks tag synergies) should have the best
// win rate; PASSIVE should miss the target. If montecarlo.ts says otherwise, the
// balance is wrong, not the test.

import { CARD_BY_ID } from './cards.ts';
import { board, exploitIntensity, MAX_PUSH, pace, synergyMult, type WeekDecision } from './engine.ts';
import { COHORTS, type CohortId, type RunState } from './types.ts';

export type Policy = (state: RunState, rand: () => number) => WeekDecision;

function revenueScore(id: string): number {
  const m = CARD_BY_ID[id].mods;
  let s = 0;
  for (const c of COHORTS) {
    const mult = m.revenueMult?.[c as CohortId] ?? 1;
    const weight = c === 'whale' ? 0.7 : c === 'dolphin' ? 0.22 : c === 'fish' ? 0.08 : 0.02;
    s += (mult - 1) * weight;
  }
  s += (m.cash ?? 0) / 500_000;
  return s;
}

function trustScore(id: string): number {
  const m = CARD_BY_ID[id].mods;
  let s = 0;
  for (const c of COHORTS) {
    s += (m.trustDelta?.[c as CohortId] ?? 0) * 0.05;
    s += (m.trustDrift?.[c as CohortId] ?? 0) * 0.08;
  }
  s -= (m.backlashDelta ?? 0) * 0.03;
  s += (m.ratingDelta ?? 0) * 0.5;
  s -= (m.leakChance ?? 0) * 0.6;
  return s;
}

/** How much would playing this card raise the board's synergy multiplier? */
function synergyGain(state: RunState, id: string): number {
  const card = CARD_BY_ID[id];
  const slot = card.persistent ?? card.duration > 1;
  if (!slot) return 0;
  const before = synergyMult(state.effects);
  const after = synergyMult([
    ...state.effects,
    { cardId: card.id, label: card.name, weeksLeft: card.duration, mods: card.mods, tags: card.tags, slot: true },
  ]);
  return after - before;
}

/** Evict the board policy with the fewest tag matches against the rest. */
function weakestSlot(state: RunState): string | null {
  const b = board(state);
  if (!b.length) return null;
  let worst = b[0];
  let worstScore = Infinity;
  for (const e of b) {
    const others = b.filter((o) => o !== e);
    const matches = e.tags.reduce((n, t) => n + others.filter((o) => o.tags.includes(t)).length, 0);
    const score = matches * 10 + e.weeksLeft;
    if (score < worstScore) {
      worstScore = score;
      worst = e;
    }
  }
  return worst.cardId;
}

export const POLICIES: Record<string, Policy> = {
  /** turns every dial to the wall, takes the biggest revenue card, always pushes */
  greedy: (state) => ({
    card: [...state.offer].sort((a, b) => revenueScore(b) - revenueScore(a))[0] ?? null,
    evict: weakestSlot(state),
    pushes: MAX_PUSH,
    dials: { gachaRatePct: 0.25, priceMult: 1.45, energyTightness: 0.9, adFreq: 0.8 },
  }),

  /** never squeezes, never pushes, plays the nicest card available */
  passive: (state) => ({
    card: [...state.offer].sort((a, b) => trustScore(b) - trustScore(a))[0] ?? null,
    evict: weakestSlot(state),
    pushes: 0,
    dials: { gachaRatePct: 1.2, priceMult: 0.95, energyTightness: 0.2, adFreq: 0 },
  }),

  /**
   * The intended way to play: build a tag-coherent board, then press your luck
   * only when the outrage meter has headroom.
   */
  builder: (state) => {
    const p = pace(state);
    const danger = state.backlash / 100;
    const weeksLeft = state.cfg.weeks - state.week + 1;

    // A skilled player is not a cautious one: backlash decays 6/week and the first
    // two outrage events are survivable, so the correct posture is "aggressive with
    // an eye on the meter", not "polite".
    let aggression = 0.68;
    if (p < 0.95) aggression += 0.2;
    if (p < 0.8) aggression += 0.15;
    if (p > 1.2) aggression -= 0.3;
    aggression -= danger * 0.55;
    if (weeksLeft <= 3) aggression += 0.35;
    aggression = Math.min(1, Math.max(0, aggression));

    const card =
      [...state.offer].sort((a, b) => {
        const sa = revenueScore(a) * aggression + trustScore(a) * (1 - aggression) + synergyGain(state, a) * 3.5;
        const sb = revenueScore(b) * aggression + trustScore(b) * (1 - aggression) + synergyGain(state, b) * 3.5;
        return sb - sa;
      })[0] ?? null;

    // push only with headroom: an incident is +26 backlash and 145 is the exit
    const headroom = (145 - state.backlash) / 145;
    const pushes =
      headroom > 0.7 ? (aggression > 0.6 ? 3 : 2) : headroom > 0.5 ? 2 : headroom > 0.32 ? 1 : 0;

    return {
      card,
      evict: weakestSlot(state),
      pushes: weeksLeft <= 1 ? MAX_PUSH : pushes,
      dials: {
        gachaRatePct: 1.1 - 0.8 * aggression,
        priceMult: 0.95 + 0.4 * aggression,
        energyTightness: 0.2 + 0.55 * aggression,
        adFreq: aggression > 0.8 ? 0.5 : 0,
      },
    };
  },

  /** the honest baseline: no plan at all */
  random: (state, rand) => ({
    card: state.offer.length ? state.offer[Math.floor(rand() * state.offer.length)] : null,
    evict: weakestSlot(state),
    pushes: Math.floor(rand() * (MAX_PUSH + 1)),
    dials: {
      gachaRatePct: 0.2 + rand() * 1.8,
      priceMult: 0.8 + rand() * 0.7,
      energyTightness: rand(),
      adFreq: rand() < 0.5 ? 0 : rand(),
    },
  }),
};

/** exposed for the UI: what the current posture is doing to the room */
export function readout(state: RunState) {
  const e = exploitIntensity(state.dials, state.effects);
  return {
    exploit: e,
    synergy: synergyMult(state.effects),
    label:
      e < -0.2 ? 'GENEROUS' : e < 0.2 ? 'FAIR' : e < 0.6 ? 'AGGRESSIVE' : e < 1.0 ? 'PREDATORY' : 'EXTRACTIVE',
  };
}
