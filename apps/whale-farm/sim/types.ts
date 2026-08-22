// WHALE FARM — core domain types.
// The whole game is this state machine; the UI is a renderer over it.

export type CohortId = 'whale' | 'dolphin' | 'fish' | 'f2p';

export const COHORTS: readonly CohortId[] = ['whale', 'dolphin', 'fish', 'f2p'];

export interface Cohort {
  id: CohortId;
  /** headcount */
  pop: number;
  /** 0..100 — how much they still believe in the game */
  trust: number;
  /** weekly revenue this cohort produced last week (for UI) */
  lastRevenue: number;
}

/**
 * A named whale. The point of naming them: you cannot feel anything about
 * "1,000 whales", but you can feel something about Kwon, who has $12,400 left.
 * This is where the game's discomfort — and its shareable screenshot — lives.
 */
export interface Whale {
  id: string;
  name: string;
  age: string;
  /** one line on why they pay. Fictional; never a real person. */
  note: string;
  /** dollars left before they are tapped out */
  wallet: number;
  /** starting wallet, for the UI's drain bar */
  wallet0: number;
  /** 0..100 — how long they'll put up with you */
  patience: number;
  /** 0..1 — how much greed this particular person tolerates */
  tolerance: number;
  /** cumulative dollars extracted */
  spent: number;
  lastSpend: number;
  status: 'active' | 'lapsed' | 'broke';
  /** week they left, for the memorial list */
  leftWeek: number | null;
}

/** The four dials the player can turn every week. Turning them costs trust. */
export interface Dials {
  /** headline gacha rate, in percent. 0.2 (brutal) .. 2.0 (generous). Neutral 0.8 */
  gachaRatePct: number;
  /** price multiplier on all bundles. 0.8 .. 1.5. Neutral 1.0 */
  priceMult: number;
  /** how hard energy gates play. 0 (none) .. 1 (suffocating). Neutral 0.35 */
  energyTightness: number;
  /** rewarded/interstitial ad load. 0 .. 1. Neutral 0 */
  adFreq: number;
}

export interface ActiveEffect {
  cardId: string;
  label: string;
  weeksLeft: number;
  mods: CardMods;
  tags: readonly string[];
  /** true = occupies one of the board's policy slots */
  slot: boolean;
}

/** How many persistent policies can run at once. The cap is what forces builds. */
export const SLOTS = 4;

/** Everything a card is allowed to do. Keeping this closed makes balancing tractable. */
export interface CardMods {
  /** multiplicative revenue modifier per cohort, e.g. { whale: 1.8 } */
  revenueMult?: Partial<Record<CohortId, number>>;
  /** one-shot trust delta per cohort, applied when the card resolves */
  trustDelta?: Partial<Record<CohortId, number>>;
  /** per-week trust delta while the effect is active */
  trustDrift?: Partial<Record<CohortId, number>>;
  /** multiplier on new-user acquisition */
  acquisitionMult?: number;
  /** immediate backlash points */
  backlashDelta?: number;
  /** immediate store-rating delta */
  ratingDelta?: number;
  /** flat cash this week (negative = marketing spend) */
  cash?: number;
  /** extra exploitation intensity contributed by this card (0..1) */
  exploit?: number;
  /** probability per week that this blows up in the press */
  leakChance?: number;
  /** churn multiplier while active */
  churnMult?: number;
}

export interface Card {
  id: string;
  /** shipping language is English (primary market = US App Store) */
  name: string;
  nameKo: string;
  /** the in-fiction memo the player reads */
  blurb: string;
  /** how many weeks the effect lasts (1 = this week only) */
  duration: number;
  mods: CardMods;
  /** cards can be gated behind meta progression */
  tier: 1 | 2 | 3;
  /**
   * Tags are the synergy currency: two active cards sharing a tag amplify each
   * other. This is what turns a list of modifiers into an engine you build.
   */
  tags: readonly string[];
  /** true = takes a persistent slot for `duration` weeks; false = resolves and is gone */
  persistent?: boolean;
}

export type RunStatus = 'running' | 'promoted' | 'fired_target' | 'fired_outrage';

export interface RunConfig {
  seed: number;
  /** revenue the board demands over 12 weeks, in dollars */
  target: number;
  weeks: number;
  startingMau: number;
}

export interface WeekLog {
  week: number;
  revenue: number;
  cumulative: number;
  exploit: number;
  rating: number;
  backlash: number;
  novelty: number;
  mau: number;
  trust: Record<CohortId, number>;
  cardPlayed: string | null;
  /** how many times the player pressed their luck this week */
  pushes: number;
  /** multiplier the policy board's tag synergies produced */
  synergy: number;
  /** whales who left or went broke this week */
  whalesLost: string[];
  events: string[];
}

export interface RunState {
  cfg: RunConfig;
  week: number;
  cohorts: Record<CohortId, Cohort>;
  whales: Whale[];
  dials: Dials;
  effects: ActiveEffect[];
  revenue: number;
  /** 1.0 .. 5.0 store rating */
  rating: number;
  /** 0..140+ public outrage meter; 140 = fired on the spot */
  backlash: number;
  /**
   * 0.45..1.05 — how fresh the game still feels. Decays every week and is only
   * refreshed by shipping content (events, banners, passes). Apologies are not
   * content. This is what makes "do nothing and be nice" a losing strategy.
   */
  novelty: number;
  status: RunStatus;
  log: WeekLog[];
  /** cards offered this week (ids) */
  offer: string[];
  /** total times the player pressed their luck this run */
  totalPushes: number;
  /** incidents caused by pushing */
  incidents: number;
  /** outrage events already fired, to avoid re-triggering on the same crossing */
  outrageCount: number;
  deck: string[];
}
