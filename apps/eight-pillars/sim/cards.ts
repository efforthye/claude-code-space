// 팔자 / EIGHT PILLARS — 간지(干支) cards.
//
// 10 heavenly stems (天干) go on the top row, 12 earthly branches (地支) on the
// bottom. Element and polarity are the real traditional assignments, because the
// onboarding advantage of this theme only exists if the rules match what players
// already know. Getting 甲 wrong would break the one thing we are buying.

import type { Element, Polarity } from './elements.ts';

export type Row = 'stem' | 'branch';

export interface GanjiCard {
  id: string;
  glyph: string;
  /** romanised, for the English build */
  name: string;
  row: Row;
  element: Element;
  polarity: Polarity;
  /** 氣 — base contribution */
  qi: number;
}

/** 天干 — 甲乙丙丁戊己庚辛壬癸 */
export const STEMS: readonly GanjiCard[] = [
  { id: 'jia', glyph: '甲', name: 'Jia', row: 'stem', element: 'wood', polarity: 'yang', qi: 18 },
  { id: 'yi', glyph: '乙', name: 'Yi', row: 'stem', element: 'wood', polarity: 'yin', qi: 14 },
  { id: 'bing', glyph: '丙', name: 'Bing', row: 'stem', element: 'fire', polarity: 'yang', qi: 19 },
  { id: 'ding', glyph: '丁', name: 'Ding', row: 'stem', element: 'fire', polarity: 'yin', qi: 15 },
  { id: 'wu', glyph: '戊', name: 'Wu', row: 'stem', element: 'earth', polarity: 'yang', qi: 17 },
  { id: 'ji', glyph: '己', name: 'Ji', row: 'stem', element: 'earth', polarity: 'yin', qi: 13 },
  { id: 'geng', glyph: '庚', name: 'Geng', row: 'stem', element: 'metal', polarity: 'yang', qi: 20 },
  { id: 'xin', glyph: '辛', name: 'Xin', row: 'stem', element: 'metal', polarity: 'yin', qi: 15 },
  { id: 'ren', glyph: '壬', name: 'Ren', row: 'stem', element: 'water', polarity: 'yang', qi: 18 },
  { id: 'gui', glyph: '癸', name: 'Gui', row: 'stem', element: 'water', polarity: 'yin', qi: 14 },
];

/** 地支 — 子丑寅卯辰巳午未申酉戌亥 */
export const BRANCHES: readonly GanjiCard[] = [
  { id: 'zi', glyph: '子', name: 'Zi', row: 'branch', element: 'water', polarity: 'yang', qi: 14 },
  { id: 'chou', glyph: '丑', name: 'Chou', row: 'branch', element: 'earth', polarity: 'yin', qi: 10 },
  { id: 'yin_b', glyph: '寅', name: 'Yin', row: 'branch', element: 'wood', polarity: 'yang', qi: 15 },
  { id: 'mao', glyph: '卯', name: 'Mao', row: 'branch', element: 'wood', polarity: 'yin', qi: 12 },
  { id: 'chen', glyph: '辰', name: 'Chen', row: 'branch', element: 'earth', polarity: 'yang', qi: 13 },
  { id: 'si', glyph: '巳', name: 'Si', row: 'branch', element: 'fire', polarity: 'yin', qi: 12 },
  { id: 'wu_b', glyph: '午', name: 'Wu', row: 'branch', element: 'fire', polarity: 'yang', qi: 16 },
  { id: 'wei', glyph: '未', name: 'Wei', row: 'branch', element: 'earth', polarity: 'yin', qi: 10 },
  { id: 'shen', glyph: '申', name: 'Shen', row: 'branch', element: 'metal', polarity: 'yang', qi: 15 },
  { id: 'you', glyph: '酉', name: 'You', row: 'branch', element: 'metal', polarity: 'yin', qi: 12 },
  { id: 'xu', glyph: '戌', name: 'Xu', row: 'branch', element: 'earth', polarity: 'yang', qi: 13 },
  { id: 'hai', glyph: '亥', name: 'Hai', row: 'branch', element: 'water', polarity: 'yin', qi: 12 },
];

export const ALL_CARDS: readonly GanjiCard[] = [...STEMS, ...BRANCHES];

export const CARD_BY_ID: Record<string, GanjiCard> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c]),
);

/**
 * A starting deck: 6 stems + 6 branches, spread across the five elements so the
 * first hand can always form at least one generation link. A deck that cannot
 * chain teaches the player nothing on turn one.
 */
export function starterDeck(): GanjiCard[] {
  const stems = ['jia', 'bing', 'wu', 'geng', 'ren', 'yi'];
  const branches = ['yin_b', 'wu_b', 'chen', 'shen', 'zi', 'you'];
  return [...stems, ...branches].map((id) => CARD_BY_ID[id]);
}
