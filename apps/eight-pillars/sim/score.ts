// 팔자 / EIGHT PILLARS — the scoring function.
//
// This is the entire game in one pure function. Everything else (draft, relics,
// meta) is scaffolding around it. If this function is not interesting, nothing
// downstream can save it — which is why montecarlo.ts interrogates it directly.
//
//        年柱      月柱      日柱      時柱
//  天干  [card]    [card]    [card]    [card]
//  地支  [card]    [card]    [card]    [card]
//        └──── links flow left → right ────┘

import { HANJA, linkKind, type Element } from './elements.ts';
import type { GanjiCard } from './cards.ts';
import type { Relic } from './relics.ts';

export interface Board {
  /** 4 heavenly stems, 年月日時 order */
  stems: (GanjiCard | null)[];
  /** 4 earthly branches, same order */
  branches: (GanjiCard | null)[];
}

export interface PillarDetail {
  index: number;
  base: number;
  dominant: Element | null;
  sameElement: boolean;
  harmonised: boolean;
  /** multiplier applied to this pillar's base by upstream destruction */
  penalty: number;
}

export interface ScoreDetail {
  score: number;
  pillars: PillarDetail[];
  /** left→right link kinds between adjacent pillars (3 links) */
  links: ('chain' | 'break' | 'flat')[];
  /** how many generation links fired */
  chainLinks: number;
  /** longest consecutive generation run */
  longestChain: number;
  /** how many destruction links fired */
  breaks: number;
  chainMult: number;
  relicMult: number;
}

/** multiplier for the 1st, 2nd, 3rd consecutive generation link */
export const CHAIN_STEPS = [1.5, 2.2, 3.5];
/** a destruction link halves every pillar downstream of it */
export const BREAK_PENALTY = 0.5;
const SAME_ELEMENT_BONUS = 1.4;
const HARMONY_BONUS = 1.2;

export function emptyBoard(): Board {
  return { stems: [null, null, null, null], branches: [null, null, null, null] };
}

function pillarBase(stem: GanjiCard | null, branch: GanjiCard | null, relics: Relic[]) {
  const qi = (stem?.qi ?? 0) + (branch?.qi ?? 0);
  const sameElement = !!stem && !!branch && stem.element === branch.element;
  const harmonised = !!stem && !!branch && stem.polarity !== branch.polarity;
  let base = qi;
  if (sameElement) {
    const bonus = relics.reduce((m, r) => m + (r.sameElementBonus ?? 0), SAME_ELEMENT_BONUS);
    base *= bonus;
  }
  if (harmonised) base *= HARMONY_BONUS;
  const dominant: Element | null = !stem && !branch
    ? null
    : !branch
      ? stem!.element
      : !stem
        ? branch.element
        : stem.qi >= branch.qi
          ? stem.element
          : branch.element;
  return { base, dominant, sameElement, harmonised };
}

export function scoreBoard(board: Board, relics: Relic[] = []): ScoreDetail {
  const raw = [0, 1, 2, 3].map((i) => pillarBase(board.stems[i], board.branches[i], relics));
  const penalties = [1, 1, 1, 1];
  const links: ('chain' | 'break' | 'flat')[] = [];

  let chainMult = 1;
  let run = 0;
  let chainLinks = 0;
  let longestChain = 0;
  let breaks = 0;

  const chainBonus = relics.reduce((s, r) => s + (r.chainLinkBonus ?? 0), 0);
  // 偏官/魁罡 turn destruction from a downstream halving into a whole-board payout.
  // They STACK multiplicatively — owning two destruction relics is a real archetype,
  // not a wasted draft.
  const breakRelics = relics.filter((r) => r.breakMult !== undefined);
  const breakPenalty = breakRelics.length ? 1 : BREAK_PENALTY;
  const breakPayout = breakRelics.reduce((m, r) => m * (r.breakMult ?? 1), 1);
  const chainsFrozen = false;

  for (let i = 0; i < 3; i++) {
    const a = raw[i].dominant;
    const b = raw[i + 1].dominant;
    if (!a || !b) {
      links.push('flat');
      run = 0;
      continue;
    }
    const kind = linkKind(a, b);
    links.push(kind);
    if (kind === 'chain') {
      chainLinks++;
      if (!chainsFrozen) {
        chainMult *= CHAIN_STEPS[Math.min(run, CHAIN_STEPS.length - 1)] + chainBonus;
        run++;
        longestChain = Math.max(longestChain, run);
      }
    } else if (kind === 'break') {
      breaks++;
      run = 0;
      for (let j = i + 1; j < 4; j++) penalties[j] *= breakPenalty;
    } else {
      run = 0;
    }
  }

  const pillars: PillarDetail[] = raw.map((r, i) => ({
    index: i,
    base: r.base * penalties[i],
    dominant: r.dominant,
    sameElement: r.sameElement,
    harmonised: r.harmonised,
    penalty: penalties[i],
  }));

  // relics that rescale a specific element's pillars (e.g. 正財: earth counts twice)
  let relicMult = 1;
  for (const r of relics) {
    if (r.flatMult) relicMult *= r.flatMult;
    if (r.elementMult) {
      const hits = pillars.filter((p) => p.dominant === r.elementMult!.element).length;
      relicMult *= Math.pow(r.elementMult.mult, hits);
    }
    if (r.perChainMult && chainLinks > 0) relicMult *= Math.pow(r.perChainMult, chainLinks);
    if (r.chainLengthBonus && longestChain >= r.chainLengthBonus.atLeast) relicMult *= r.chainLengthBonus.mult;
    if (r.breakCountBonus && breaks >= r.breakCountBonus.atLeast) relicMult *= r.breakCountBonus.mult;
  }
  // destruction pays out instead of punishing, when a relic says so
  if (breaks > 0 && breakPayout > 1) relicMult *= Math.pow(breakPayout, breaks);

  const sum = pillars.reduce((s, p) => s + p.base, 0);
  return {
    score: Math.round(sum * chainMult * relicMult),
    pillars,
    links,
    chainLinks,
    longestChain,
    breaks,
    chainMult,
    relicMult,
  };
}

/**
 * Human-readable board, used by the share card and by debugging.
 * Takes the relics: without them the score shown is not the score that was played,
 * which makes a destruction build look like a mistake.
 */
export function describeBoard(board: Board, relics: Relic[] = []): string {
  const cell = (c: GanjiCard | null) => c?.glyph ?? '·';
  const top = board.stems.map(cell).join(' ');
  const bottom = board.branches.map(cell).join(' ');
  const d = scoreBoard(board, relics);
  const arrows = d.links
    .map((k) => (k === 'chain' ? '→' : k === 'break' ? '✕' : '·'))
    .join('  ');
  const doms = d.pillars.map((p) => (p.dominant ? HANJA[p.dominant] : '·')).join('  ');
  return `${top}\n${bottom}\n${doms}\n  ${arrows}  = ${d.score}`;
}
