// 팔자 / EIGHT PILLARS — Monte Carlo harness and the design assertions.
//
// Run: node sim/montecarlo.ts [runs]
//
// The five assertions below are this design's falsifiable claims. If they fail,
// the concept fails — the same way WHALE FARM's did, and we say so instead of
// polishing a game that isn't one.

import { makeRng } from './rng.ts';
import { starterDeck } from './cards.ts';
import { RELICS } from './relics.ts';
import { describeBoard } from './score.ts';
import { bestPlacement, greedyPlacement, playRun, randomPlacement, targetFor, STAGES } from './run.ts';

const RUNS = Number(process.argv[2] ?? 3000);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0;
};
const pct = (x: number) => (x * 100).toFixed(1) + '%';
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

console.log(`\n팔자 / EIGHT PILLARS — Monte Carlo (${RUNS} runs)\n`);

// ── A1 · placement matters ─────────────────────────────────────────────────────
// Same hand, same relics: how much does thinking about the element graph pay?
const ratios: number[] = [];
const greedyRatios: number[] = [];
const randomBreaks: number[] = [];
for (let i = 0; i < RUNS; i++) {
  const rng = makeRng(7919 + i * 31);
  const deck = starterDeck();
  const hand = [
    ...rng.shuffle(deck.filter((c) => c.row === 'stem')).slice(0, 4),
    ...rng.shuffle(deck.filter((c) => c.row === 'branch')).slice(0, 4),
  ];
  const relics = rng.sample(RELICS, 2);
  const best = bestPlacement(hand, relics).detail;
  const rand = randomPlacement(hand, relics, rng).detail;
  const greedy = greedyPlacement(hand, relics).detail;
  if (rand.score > 0) ratios.push(best.score / rand.score);
  if (greedy.score > 0) greedyRatios.push(best.score / greedy.score);
  randomBreaks.push(rand.breaks > 0 ? 1 : 0);
}

console.log('A1  PLACEMENT');
console.log(`    best / random arrangement   mean ×${mean(ratios).toFixed(2)}   median ×${quantile(ratios, 0.5).toFixed(2)}   p90 ×${quantile(ratios, 0.9).toFixed(2)}`);
console.log(`    best / power-sorted (greedy) mean ×${mean(greedyRatios).toFixed(2)}`);
console.log(`    random boards containing a 相剋 break: ${pct(mean(randomBreaks))}`);

// ── A2/A3/A5 · full runs by strategy ──────────────────────────────────────────
interface Agg { win: number; cleared: number[]; best: number[]; relicCounts: Map<string, number>; }
function runMany(placement: 'best' | 'greedy' | 'random', draft: 'smart' | 'random'): Agg {
  const agg: Agg = { win: 0, cleared: [], best: [], relicCounts: new Map() };
  for (let i = 0; i < RUNS; i++) {
    const r = playRun(1000 + i * 17, placement, draft);
    if (r.won) agg.win++;
    agg.cleared.push(r.stagesCleared);
    agg.best.push(r.bestStageScore);
    r.relics.forEach((id) => agg.relicCounts.set(id, (agg.relicCounts.get(id) ?? 0) + 1));
  }
  return agg;
}

const smart = runMany('best', 'smart');
const dumbDraft = runMany('best', 'random');
const greedyPlace = runMany('greedy', 'smart');
const randomPlace = runMany('random', 'smart');

console.log('\nA2/A3/A5  RUNS');
console.log('  strategy'.padEnd(26) + 'win%'.padStart(8) + 'avg stages'.padStart(12) + 'median peak'.padStart(14) + 'p99 peak'.padStart(12));
console.log('  ' + '-'.repeat(70));
const row = (label: string, a: Agg) =>
  console.log(
    ('  ' + label).padEnd(26) +
      pct(a.win / RUNS).padStart(8) +
      mean(a.cleared).toFixed(2).padStart(12) +
      num(quantile(a.best, 0.5)).padStart(14) +
      num(quantile(a.best, 0.99)).padStart(12),
  );
row('optimal + smart draft', smart);
row('optimal + random draft', dumbDraft);
row('power-sorted + smart', greedyPlace);
row('random place + smart', randomPlace);

// "no ceiling" is about overshoot: can a realised build blow past what the game asks?
const ceiling = quantile(smart.best, 0.99) / targetFor(STAGES);
console.log(`\n  build overshoot (p99 peak / final target): ×${ceiling.toFixed(1)}`);
console.log(`  stage targets: ${[1, 4, 6, 8].map((s) => `#${s}=${num(targetFor(s))}`).join('  ')}   (${STAGES} stages)`);

// relic popularity tells us whether any relic is dead or dominant
const total = [...smart.relicCounts.values()].reduce((a, b) => a + b, 0) || 1;
const popularity = RELICS.map((r) => ({
  id: r.id,
  glyph: r.glyph,
  share: (smart.relicCounts.get(r.id) ?? 0) / total,
})).sort((a, b) => b.share - a.share);
console.log('\n  relic pick share (smart draft):');
console.log('    ' + popularity.map((p) => `${p.glyph} ${pct(p.share)}`).join('   '));

// ── assertions ─────────────────────────────────────────────────────────────────
console.log('\nDESIGN ASSERTIONS');
const checks: [string, boolean, string][] = [
  [
    'A1 placement matters: optimal ≥5× a careless arrangement',
    mean(ratios) >= 5,
    `×${mean(ratios).toFixed(2)}`,
  ],
  [
    'A2 builds have no ceiling: p99 peak ≥ 10× the final target',
    ceiling >= 10,
    `×${ceiling.toFixed(1)}`,
  ],
  [
    'A3 not solved: optimal+smart win rate in 40..70%',
    smart.win / RUNS >= 0.4 && smart.win / RUNS <= 0.7,
    pct(smart.win / RUNS),
  ],
  [
    'A4 相剋 is a real trap: ≥30% of careless boards break a chain',
    mean(randomBreaks) >= 0.3,
    pct(mean(randomBreaks)),
  ],
  [
    'A5 drafting matters: smart draft beats random draft by ≥20pp',
    (smart.win - dumbDraft.win) / RUNS >= 0.2,
    `${pct(smart.win / RUNS)} vs ${pct(dumbDraft.win / RUNS)}`,
  ],
  [
    'A6 no dead relic: every relic picked at least 3% of the time',
    popularity.every((p) => p.share >= 0.03),
    popularity[popularity.length - 1].glyph + ' ' + pct(popularity[popularity.length - 1].share),
  ],
];

let failed = 0;
for (const [label, ok, detail] of checks) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`);
}

// ── show one board, because numbers alone hide whether this reads ──────────────
{
  const rng = makeRng(4242);
  const deck = starterDeck();
  const hand = [
    ...rng.shuffle(deck.filter((c) => c.row === 'stem')).slice(0, 4),
    ...rng.shuffle(deck.filter((c) => c.row === 'branch')).slice(0, 4),
  ];
  const relics = rng.sample(RELICS, 2);
  console.log(`\nSAMPLE BOARD  (relics: ${relics.map((r) => r.glyph).join(' ')})`);
  console.log('  optimal:');
  console.log(describeBoard(bestPlacement(hand, relics).board, relics).split('\n').map((l) => '    ' + l).join('\n'));
  console.log('  careless:');
  console.log(describeBoard(randomPlacement(hand, relics, rng).board, relics).split('\n').map((l) => '    ' + l).join('\n'));
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
