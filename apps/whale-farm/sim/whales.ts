// WHALE FARM — the named whales.
//
// Design reason for naming them: nobody feels anything about "1,000 whales", but
// everybody feels something about Kwon, who has $12,400 left. Named whales do
// three jobs at once:
//   1. they are the build targets — each pays for different policies (affinity),
//      so your policy board decides WHO funds your quarter;
//   2. they are a destructible resource — patience runs out, wallets run dry,
//      and both are permanent;
//   3. they are the screenshot — "I bankrupted three people in four weeks".
//
// All characters are fictional and deliberately non-identifying.

import type { Whale } from './types.ts';

interface WhaleSeed {
  id: string;
  name: string;
  age: string;
  note: string;
  wallet: number;
  /** 0..1 — how much extraction this person tolerates before patience burns */
  tolerance: number;
  /** policy tags this person pays extra for */
  affinity: readonly string[];
}

export const WHALE_SEEDS: readonly WhaleSeed[] = [
  {
    id: 'kwon',
    name: 'KWON',
    age: '34',
    note: 'Buys every banner the day it drops. Keeps a spreadsheet of his own pulls.',
    wallet: 340_000,
    tolerance: 0.55,
    affinity: ['gacha'],
  },
  {
    id: 'halversen',
    name: 'M. HALVERSEN',
    age: '51',
    note: 'Completes the collection. Has not finished a single level.',
    wallet: 460_000,
    tolerance: 0.7,
    affinity: ['cosmetic', 'gacha'],
  },
  {
    id: 'rui',
    name: 'RUI',
    age: '22',
    note: 'Cannot be second. Checks the ladder before checking messages.',
    wallet: 165_000,
    tolerance: 0.85,
    affinity: ['p2w', 'pvp'],
  },
  {
    id: 'oyelaran',
    name: 'DR. OYELARAN',
    age: '44',
    note: 'Paid $2,000 once to skip the grind. Has been paying to stay ahead of it since.',
    wallet: 250_000,
    tolerance: 0.4,
    affinity: ['vip', 'pricing'],
  },
  {
    id: 'takahashi',
    name: 'TAKAHASHI',
    age: '29',
    note: 'Streams the pulls. The audience pays for maybe a third of them.',
    wallet: 300_000,
    tolerance: 0.6,
    affinity: ['gacha', 'risk'],
  },
  {
    id: 'novak',
    name: 'B. NOVAK',
    age: '38',
    note: 'Quit twice. Came back twice. Says this is the last time.',
    wallet: 185_000,
    tolerance: 0.25,
    affinity: ['retention'],
  },
  {
    id: 'ghostparade',
    name: 'GHOSTPARADE',
    age: '—',
    note: 'No name on the account, no support tickets, $61,000 in four months.',
    wallet: 520_000,
    tolerance: 0.75,
    affinity: ['dark-pattern', 'vip'],
  },
];

export const WHALE_AFFINITY: Record<string, readonly string[]> = Object.fromEntries(
  WHALE_SEEDS.map((w) => [w.id, w.affinity]),
);

export function newWhales(): Whale[] {
  return WHALE_SEEDS.map((s) => ({
    id: s.id,
    name: s.name,
    age: s.age,
    note: s.note,
    wallet: s.wallet,
    wallet0: s.wallet,
    patience: 82,
    tolerance: s.tolerance,
    spent: 0,
    lastSpend: 0,
    status: 'active' as const,
    leftWeek: null,
  }));
}
