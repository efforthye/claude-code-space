// 팔자 / EIGHT PILLARS — 오행(五行) relations.
//
// The whole game rests on this one graph. Two directed cycles over five nodes:
//   相生 (generates, good):  木 → 火 → 土 → 金 → 水 → 木
//   相剋 (overcomes, bad):   木 → 土 → 水 → 火 → 金 → 木
//
// Design note: the second cycle is why this is not a Balatro clone. Generation
// chains reward ordering; destruction punishes it. Placement becomes a puzzle
// with both a carrot and a stick, which a purely additive multiplier game lacks.

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type Polarity = 'yang' | 'yin';

export const ELEMENTS: readonly Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

export const HANJA: Record<Element, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};

/** 相生 — a generates b */
const GENERATES: Record<Element, Element> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
};

/** 相剋 — a overcomes b */
const OVERCOMES: Record<Element, Element> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
};

export type Relation = 'generates' | 'overcomes' | 'generated_by' | 'overcome_by' | 'same' | 'none';

export function relation(a: Element, b: Element): Relation {
  if (a === b) return 'same';
  if (GENERATES[a] === b) return 'generates';
  if (OVERCOMES[a] === b) return 'overcomes';
  if (GENERATES[b] === a) return 'generated_by';
  if (OVERCOMES[b] === a) return 'overcome_by';
  return 'none';
}

/** Only left→right matters for chains, so this is the scoring-relevant reduction. */
export function linkKind(a: Element, b: Element): 'chain' | 'break' | 'flat' {
  const r = relation(a, b);
  if (r === 'generates') return 'chain';
  if (r === 'overcomes') return 'break';
  return 'flat';
}
