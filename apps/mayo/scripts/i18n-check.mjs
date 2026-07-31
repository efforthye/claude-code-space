#!/usr/bin/env node
/**
 * Check every locale against the English base.
 *
 * With fifteen languages, key drift is not a possibility — it is a certainty
 * unless something checks. Three failure modes, all silent at runtime because
 * translate() falls back to English:
 *
 *   missing        a key en.ts has and this locale does not (falls back, so
 *                  the user sees English in the middle of their language)
 *   extra          a key this locale has and en.ts does not (dead weight, or
 *                  a typo'd key that will never be looked up)
 *   placeholders   `{n}`, `{title}` etc. that differ from English — this one
 *                  is not cosmetic. A dropped placeholder ships a literal
 *                  "{n} credits" to the user, and an invented one renders
 *                  nothing.
 *
 * Missing keys are reported but do NOT fail the run: shipping a partially
 * translated language is deliberate. Extra keys and placeholder mismatches DO
 * fail — those are bugs, not incompleteness.
 *
 * Run: node scripts/i18n-check.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

/** Pull `'key': 'value'` pairs out of a locale file without importing TS. */
function parseLocale(file) {
  const src = readFileSync(join(DIR, file), 'utf8');
  const out = new Map();
  // Values may be single- or double-quoted, and may span lines after a `:`.
  const re = /^\s*'([^']+)':\s*((?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(?:\s*\+\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))*)/gms;
  let m;
  while ((m = re.exec(src)) !== null) out.set(m[1], m[2]);
  return out;
}

const placeholders = (value) =>
  new Set((value.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g) || []).sort());

const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
const base = parseLocale('en.ts');
console.log(`base: en.ts — ${base.size} keys\n`);

let failed = false;
let incomplete = 0;

for (const file of files.sort()) {
  if (file === 'en.ts') continue;
  const loc = parseLocale(file);
  const missing = [...base.keys()].filter((k) => !loc.has(k));
  const extra = [...loc.keys()].filter((k) => !base.has(k));

  const badPlaceholders = [];
  for (const [key, value] of loc) {
    if (!base.has(key)) continue;
    const want = placeholders(base.get(key));
    const got = placeholders(value);
    if (want.size !== got.size || [...want].some((p) => !got.has(p))) {
      badPlaceholders.push(`${key}: expected ${[...want].join(' ') || '(none)'}, got ${[...got].join(' ') || '(none)'}`);
    }
  }

  const done = (((base.size - missing.length) / base.size) * 100).toFixed(0);
  const status = extra.length || badPlaceholders.length ? 'FAIL' : missing.length ? 'partial' : 'ok';
  console.log(`${file.padEnd(14)} ${String(loc.size).padStart(4)} keys  ${String(done).padStart(3)}%  ${status}`);

  if (missing.length) {
    incomplete++;
    console.log(`   missing ${missing.length}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
  }
  if (extra.length) {
    failed = true;
    console.log(`   EXTRA ${extra.length}: ${extra.join(', ')}`);
  }
  for (const p of badPlaceholders) {
    failed = true;
    console.log(`   PLACEHOLDER ${p}`);
  }
}

console.log(
  `\n${failed ? 'FAILED' : 'passed'} — ${files.length - 1} locale(s), ${incomplete} still incomplete.`
);
process.exit(failed ? 1 : 0);
