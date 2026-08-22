// WHALE FARM — Monte Carlo balancing harness.
//
// Run: node sim/montecarlo.ts [runsPerPolicy]
//
// This is the project's core asset. A solo developer cannot hand-balance an
// economy sim; 10k simulated quarters per policy can. Every balance change should
// be judged here before it is judged by feel.

import { makeRng } from './rng.ts';
import { advanceWeek, defaultConfig, newRun } from './engine.ts';
import { POLICIES } from './policies.ts';
import type { RunState, RunStatus } from './types.ts';

interface Outcome {
  status: RunStatus;
  revenue: number;
  weeksSurvived: number;
  finalRating: number;
  peakBacklash: number;
  finalMau: number;
  /** named whales who went broke or walked out */
  whalesLost: number;
  /** best tag-synergy multiplier the board reached */
  peakSynergy: number;
  incidents: number;
}

function simulate(seed: number, policyName: keyof typeof POLICIES): Outcome {
  const policy = POLICIES[policyName];
  const rng = makeRng(seed ^ 0x5bf03635);
  let state: RunState = newRun(defaultConfig(seed));
  let peakBacklash = 0;
  while (state.status === 'running') {
    const decision = policy(state, rng.next);
    state = advanceWeek(state, decision);
    peakBacklash = Math.max(peakBacklash, state.backlash);
  }
  return {
    status: state.status,
    revenue: state.revenue,
    weeksSurvived: state.log.length,
    finalRating: state.rating,
    peakBacklash,
    finalMau: state.log.at(-1)?.mau ?? 0,
    whalesLost: state.whales.filter((w) => w.status !== 'active').length,
    peakSynergy: Math.max(1, ...state.log.map((l) => l.synergy)),
    incidents: state.incidents,
  };
}

function pct(n: number, total: number) {
  return ((n / total) * 100).toFixed(1) + '%';
}

function money(n: number) {
  return '$' + (n / 1_000_000).toFixed(2) + 'M';
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

const RUNS = Number(process.argv[2] ?? 4000);
const target = defaultConfig(0).target;

console.log(`\nWHALE FARM — Monte Carlo (${RUNS} runs/policy, target ${money(target)}/12wk)\n`);
console.log(
  'policy'.padEnd(9) +
    'win%'.padStart(7) +
    'f:target'.padStart(10) +
    'f:rage'.padStart(8) +
    'med.rev'.padStart(10) +
    'mean.rev'.padStart(10) +
    'wks'.padStart(6) +
    'rating'.padStart(8) +
    'whalesLost'.padStart(12) +
    'synergy'.padStart(9) +
    'incid'.padStart(7),
);
console.log('-'.repeat(96));

const summary: Record<
  string,
  { win: number; revenue: number[]; whalesLost: number[]; rate: number[] }
> = {};

for (const name of Object.keys(POLICIES)) {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < RUNS; i++) outcomes.push(simulate(1000 + i * 31, name));

  const promoted = outcomes.filter((o) => o.status === 'promoted').length;
  const firedTarget = outcomes.filter((o) => o.status === 'fired_target').length;
  const firedRage = outcomes.filter((o) => o.status === 'fired_outrage').length;
  const revs = outcomes.map((o) => o.revenue);

  summary[name] = {
    win: promoted / RUNS,
    revenue: revs,
    whalesLost: outcomes.map((o) => o.whalesLost),
    // "greed is tempting" is a RATE claim, not a total: a policy that gets fired in
    // week 5 can still be the most profitable week-by-week, which is the trap.
    rate: outcomes.map((o) => o.revenue / Math.max(1, o.weeksSurvived)),
  };

  console.log(
    name.padEnd(9) +
      pct(promoted, RUNS).padStart(7) +
      pct(firedTarget, RUNS).padStart(10) +
      pct(firedRage, RUNS).padStart(8) +
      money(median(revs)).padStart(10) +
      money(mean(revs)).padStart(10) +
      mean(outcomes.map((o) => o.weeksSurvived)).toFixed(1).padStart(6) +
      mean(outcomes.map((o) => o.finalRating)).toFixed(2).padStart(8) +
      (mean(outcomes.map((o) => o.whalesLost)).toFixed(1) + '/7').padStart(12) +
      mean(outcomes.map((o) => o.peakSynergy)).toFixed(2).padStart(9) +
      mean(outcomes.map((o) => o.incidents)).toFixed(1).padStart(7),
  );
}

// ── Design assertions ──────────────────────────────────────────────────────────
// These are the falsifiable claims of the design. If they fail, the game is not
// the game we designed.

console.log('\nDESIGN ASSERTIONS');
const checks: [string, boolean, string][] = [
  [
    'skill matters: builder beats random by >15pp',
    summary.builder.win - summary.random.win > 0.15,
    `${pct(summary.builder.win, 1)} vs ${pct(summary.random.win, 1)}`,
  ],
  [
    'greed is punished: greedy win% < builder win%',
    summary.greedy.win < summary.builder.win,
    `${pct(summary.greedy.win, 1)} vs ${pct(summary.builder.win, 1)}`,
  ],
  [
    'greed is tempting: greedy extracts more per week than builder',
    mean(summary.greedy.rate) > mean(summary.builder.rate),
    `${money(mean(summary.greedy.rate))}/wk vs ${money(mean(summary.builder.rate))}/wk`,
  ],
  [
    'being nice is not a strategy: passive win% < 25%',
    summary.passive.win < 0.25,
    pct(summary.passive.win, 1),
  ],
  [
    'the game is beatable but not solved: builder win% in 30..75%',
    summary.builder.win >= 0.3 && summary.builder.win <= 0.75,
    pct(summary.builder.win, 1),
  ],
  [
    'the people are destructible: greedy loses more whales than builder',
    mean(summary.greedy.whalesLost) > mean(summary.builder.whalesLost) + 0.5,
    `${mean(summary.greedy.whalesLost).toFixed(1)} vs ${mean(summary.builder.whalesLost).toFixed(1)} of 7`,
  ],
];

let failed = 0;
for (const [label, ok, detail] of checks) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
