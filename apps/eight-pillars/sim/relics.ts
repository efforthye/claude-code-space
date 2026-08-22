// 팔자 / EIGHT PILLARS — 십신(十神) relics.
//
// Relics are the run's build identity. Design rule inherited from the previous
// project: no relic may be strictly good. Each one either narrows what boards
// score well, or trades a mechanic away.

import type { Element } from './elements.ts';

export interface Relic {
  id: string;
  glyph: string;
  name: string;
  nameKo: string;
  blurb: string;
  /** added to every chain step multiplier */
  chainLinkBonus?: number;
  /** multiplier raised to the number of generation links */
  perChainMult?: number;
  /** flat multiplier on the whole board */
  flatMult?: number;
  /** multiplier raised to the number of pillars dominated by this element */
  elementMult?: { element: Element; mult: number };
  /** added to the same-element pillar bonus */
  sameElementBonus?: number;
  /**
   * Turns 相剋 from a penalty into a payout: each destruction link multiplies the
   * board by this instead of halving everything downstream. This is what makes an
   * anti-chain build possible, and build diversity is the whole point of relics.
   */
  breakMult?: number;
  /** flat multiplier that only fires if the longest generation run reaches n */
  chainLengthBonus?: { atLeast: number; mult: number };
  /** flat multiplier that only fires if the board contains at least n breaks */
  breakCountBonus?: { atLeast: number; mult: number };
}

export const RELICS: readonly Relic[] = [
  {
    id: 'shishen',
    glyph: '食神',
    name: 'Nourishing Spirit',
    nameKo: '식신',
    blurb: '상생 고리 하나하나가 더 굵어진다. 고리가 없으면 아무 일도 일어나지 않는다.',
    chainLinkBonus: 0.6,
  },
  {
    id: 'zhengcai',
    glyph: '正財',
    name: 'Honest Wealth',
    nameKo: '정재',
    blurb: '土가 지배하는 기둥마다 판이 두 배로 계산된다. 土는 상생 고리의 중간이라 놓기가 어렵다.',
    elementMult: { element: 'earth', mult: 1.8 },
  },
  {
    id: 'bijian',
    glyph: '比肩',
    name: 'Shoulder to Shoulder',
    nameKo: '비견',
    blurb: '같은 오행끼리 붙인 기둥이 훨씬 강해진다. 대신 같은 오행은 고리를 만들지 못한다.',
    sameElementBonus: 0.9,
  },
  {
    id: 'pianguan',
    glyph: '偏官',
    name: 'Sideways Authority',
    nameKo: '편관',
    blurb: '상극이 뒤를 깎지 않고 오히려 판 전체를 2.6배로 만든다. 고리를 버리고 파괴를 쌓는 길.',
    breakMult: 2.2,
  },
  {
    id: 'shangguan',
    glyph: '傷官',
    name: 'Wounded Officer',
    nameKo: '상관',
    blurb: '상생 고리 하나당 판 전체가 1.65배. 고리를 못 만든 판은 그냥 맨몸이다.',
    perChainMult: 1.65,
  },
  {
    id: 'yangren',
    glyph: '羊刃',
    name: 'Blade of the Ram',
    nameKo: '양인',
    blurb: '네 기둥이 끊기지 않고 이어지면 판 전체가 4.5배. 하나만 어긋나면 아무것도 아니다.',
    chainLengthBonus: { atLeast: 3, mult: 4.5 },
  },
  {
    id: 'kuigang',
    glyph: '魁罡',
    name: 'Commanding Star',
    nameKo: '괴강',
    blurb: '상극 하나당 1.8배, 둘 이상이면 거기에 4배가 더 붙는다. 파괴를 모으는 길의 끝.',
    breakMult: 1.8,
    breakCountBonus: { atLeast: 2, mult: 4 },
  },
  {
    id: 'yinshou',
    glyph: '印綬',
    name: 'Seal of Office',
    nameKo: '인수',
    blurb: '무슨 판이든 1.6배. 조건이 없는 대신 다른 유물보다 천장이 낮다.',
    flatMult: 1.6,
  },
  {
    id: 'jiecai',
    glyph: '劫財',
    name: 'Robbed Wealth',
    nameKo: '겁재',
    blurb: '水가 지배하는 기둥마다 두 배. 水는 고리의 끝이자 시작이다.',
    elementMult: { element: 'water', mult: 1.8 },
  },
  {
    id: 'zhengguan',
    glyph: '正官',
    name: 'Upright Officer',
    nameKo: '정관',
    blurb: '火가 지배하는 기둥마다 두 배. 火는 木 다음, 土 앞에 선다.',
    elementMult: { element: 'fire', mult: 1.8 },
  },
];

export const RELIC_BY_ID: Record<string, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
