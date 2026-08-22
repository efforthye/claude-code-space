// 팔자 / EIGHT PILLARS — one run: 8 대운 (fate stages) of rising targets.
//
// Structure is deliberately the proven roguelite shape (score a hand → draft →
// repeat against a rising bar). The novelty is entirely inside scoreBoard();
// wrapping novel scoring in a familiar loop is how Balatro-likes stay learnable.

import { ALL_CARDS, starterDeck, type GanjiCard } from './cards.ts';
import { RELICS, type Relic } from './relics.ts';
import { emptyBoard, scoreBoard, type Board, type ScoreDetail } from './score.ts';
import { makeRng, type Rng } from './rng.ts';

export const STAGES = 8;

/** rising bar per 대운 */
export function targetFor(stage: number): number {
  return Math.round(220 * Math.pow(2.06, stage - 1));
}

export interface Placement {
  board: Board;
  detail: ScoreDetail;
}

/** Every legal arrangement of a hand: 4 stems × 4 branches = 4! · 4! = 576. */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i++) {
    const rest = xs.slice(0, i).concat(xs.slice(i + 1));
    for (const p of permutations(rest)) out.push([xs[i], ...p]);
  }
  return out;
}

function buildBoard(stems: (GanjiCard | null)[], branches: (GanjiCard | null)[]): Board {
  const b = emptyBoard();
  for (let i = 0; i < 4; i++) {
    b.stems[i] = stems[i] ?? null;
    b.branches[i] = branches[i] ?? null;
  }
  return b;
}

function pad(xs: GanjiCard[]): (GanjiCard | null)[] {
  const a: (GanjiCard | null)[] = xs.slice(0, 4);
  while (a.length < 4) a.push(null);
  return a;
}

/** Exhaustive best arrangement. Cheap enough to be the in-game hint button. */
export function bestPlacement(hand: GanjiCard[], relics: Relic[]): Placement {
  const stems = hand.filter((c) => c.row === 'stem').slice(0, 4);
  const branches = hand.filter((c) => c.row === 'branch').slice(0, 4);
  let best: Placement | null = null;
  for (const sp of permutations(stems)) {
    for (const bp of permutations(branches)) {
      const board = buildBoard(pad(sp), pad(bp));
      const detail = scoreBoard(board, relics);
      if (!best || detail.score > best.detail.score) best = { board, detail };
    }
  }
  if (!best) {
    const board = emptyBoard();
    return { board, detail: scoreBoard(board, relics) };
  }
  return best;
}

/** A player who just drops cards down without thinking. */
export function randomPlacement(hand: GanjiCard[], relics: Relic[], rng: Rng): Placement {
  const stems = rng.shuffle(hand.filter((c) => c.row === 'stem')).slice(0, 4);
  const branches = rng.shuffle(hand.filter((c) => c.row === 'branch')).slice(0, 4);
  const board = buildBoard(pad(stems), pad(branches));
  return { board, detail: scoreBoard(board, relics) };
}

/** A player who sorts by raw power and ignores the element graph. */
export function greedyPlacement(hand: GanjiCard[], relics: Relic[]): Placement {
  const byQi = (a: GanjiCard, b: GanjiCard) => b.qi - a.qi;
  const stems = hand.filter((c) => c.row === 'stem').sort(byQi).slice(0, 4);
  const branches = hand.filter((c) => c.row === 'branch').sort(byQi).slice(0, 4);
  const board = buildBoard(pad(stems), pad(branches));
  return { board, detail: scoreBoard(board, relics) };
}

export type PlacementStrategy = 'best' | 'random' | 'greedy';
export type DraftStrategy = 'smart' | 'random';

export interface StageLog {
  stage: number;
  target: number;
  score: number;
  chainLinks: number;
  breaks: number;
  took: string | null;
}

export interface RunResult {
  won: boolean;
  stagesCleared: number;
  relics: string[];
  log: StageLog[];
  bestStageScore: number;
}

function drawHand(deck: GanjiCard[], rng: Rng): GanjiCard[] {
  const stems = rng.shuffle(deck.filter((c) => c.row === 'stem')).slice(0, 4);
  const branches = rng.shuffle(deck.filter((c) => c.row === 'branch')).slice(0, 4);
  return [...stems, ...branches];
}

/** Draft offer: 2 relics + 1 card, which is the shape that makes builds diverge. */
function draftOffer(owned: Relic[], rng: Rng) {
  const pool = RELICS.filter((r) => !owned.some((o) => o.id === r.id));
  const relicOptions = rng.sample(pool, Math.min(2, pool.length));
  const cardOption = rng.pick(ALL_CARDS);
  return { relicOptions, cardOption };
}

export function playRun(
  seed: number,
  placement: PlacementStrategy = 'best',
  draft: DraftStrategy = 'smart',
): RunResult {
  const rng = makeRng(seed);
  let deck = starterDeck();
  const relics: Relic[] = [];
  const log: StageLog[] = [];
  let bestStageScore = 0;

  for (let stage = 1; stage <= STAGES; stage++) {
    const hand = drawHand(deck, rng);
    const p =
      placement === 'best'
        ? bestPlacement(hand, relics)
        : placement === 'greedy'
          ? greedyPlacement(hand, relics)
          : randomPlacement(hand, relics, rng);
    const target = targetFor(stage);
    bestStageScore = Math.max(bestStageScore, p.detail.score);

    if (p.detail.score < target) {
      log.push({
        stage,
        target,
        score: p.detail.score,
        chainLinks: p.detail.chainLinks,
        breaks: p.detail.breaks,
        took: null,
      });
      return { won: false, stagesCleared: stage - 1, relics: relics.map((r) => r.id), log, bestStageScore };
    }

    // draft
    let took: string | null = null;
    if (stage < STAGES) {
      const offer = draftOffer(relics, rng);
      if (draft === 'random') {
        const all: Array<Relic | GanjiCard> = [...offer.relicOptions, offer.cardOption];
        const chosen = rng.pick(all);
        if ('qi' in chosen) {
          deck = [...deck, chosen];
          took = chosen.glyph;
        } else {
          relics.push(chosen);
          took = chosen.glyph;
        }
      } else {
        // smart: try each option against this same hand and take the biggest gain
        let bestGain = -Infinity;
        let bestPick: Relic | GanjiCard | null = null;
        for (const r of offer.relicOptions) {
          const gain = bestPlacement(hand, [...relics, r]).detail.score - p.detail.score;
          if (gain > bestGain) {
            bestGain = gain;
            bestPick = r;
          }
        }
        // a card's value is its qi relative to the deck's weakest of that row
        const row = offer.cardOption.row;
        const weakest = Math.min(...deck.filter((c) => c.row === row).map((c) => c.qi));
        const cardGain = (offer.cardOption.qi - weakest) * 12;
        if (cardGain > bestGain) bestPick = offer.cardOption;
        if (bestPick && 'qi' in bestPick) {
          deck = [...deck, bestPick];
          took = bestPick.glyph;
        } else if (bestPick) {
          relics.push(bestPick);
          took = bestPick.glyph;
        }
      }
    }

    log.push({
      stage,
      target,
      score: p.detail.score,
      chainLinks: p.detail.chainLinks,
      breaks: p.detail.breaks,
      took,
    });
  }

  return { won: true, stagesCleared: STAGES, relics: relics.map((r) => r.id), log, bestStageScore };
}
