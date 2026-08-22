// Deterministic seeded RNG. Every run must be reproducible from (seed, decisions)
// so daily-challenge seeds and Monte Carlo balancing both work.

/** mulberry32 — small, fast, good enough for game sim. */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** uniform in [lo, hi) */
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    /** true with probability p */
    chance: (p: number) => next() < p,
    /** pick one element */
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    /** pick n distinct elements (n <= xs.length) */
    sample: <T>(xs: readonly T[], n: number): T[] => {
      const pool = xs.slice();
      const out: T[] = [];
      for (let i = 0; i < n && pool.length > 0; i++) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      }
      return out;
    },
  };
}

export type Rng = ReturnType<typeof makeRng>;

/** Hash a string into a seed, so "2026-08-19" can be a daily challenge seed. */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
