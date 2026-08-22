// Runtime smoke test for the playable prototype, without a browser.
//
// A syntax check is not enough: the interesting bugs are "renderAll() throws on
// week 1". So we stub just enough DOM for the UI script to boot, then drive a
// whole quarter through the real click handlers.
//
// Run: node tools/smoke-ui.ts

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'web/prototype.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 2) throw new Error(`expected 2 script blocks, got ${scripts.length}`);

// ── the smallest DOM that boots the prototype ──────────────────────────────────
class El {
  id: string;
  tag: string;
  children: El[] = [];
  listeners: Record<string, Array<() => void>> = {};
  style: Record<string, string> = {};
  className = '';
  _text = '';
  _html = '';
  attrs: Record<string, string> = {};
  disabled = false;
  value = '';
  firstChild = { nodeValue: '' };

  constructor(tag: string, id = '') {
    this.tag = tag;
    this.id = id;
  }
  get textContent() { return this._text; }
  set textContent(v: any) { this._text = String(v); this.firstChild.nodeValue = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v: any) { this._html = String(v); this.children = []; }
  appendChild(c: El) { this.children.push(c); return c; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  getAttribute(k: string) { return this.attrs[k]; }
  addEventListener(ev: string, fn: () => void) {
    (this.listeners[ev] ||= []).push(fn);
  }
  click() { (this.listeners.click ?? []).forEach((f) => f()); }
  input() { (this.listeners.input ?? []).forEach((f) => f()); }
  classList = {
    add: (_c: string) => {},
    remove: (_c: string) => {},
    contains: (_c: string) => false,
  };
}

const registry = new Map<string, El>();
// every id the template references
for (const m of html.matchAll(/id="([A-Za-z0-9_-]+)"/g)) {
  registry.set(m[1], new El('div', m[1]));
}
// range inputs carry their default value
for (const [id, v] of [['dGacha', '80'], ['dPrice', '100'], ['dEnergy', '35'], ['dAd', '0']]) {
  registry.get(id)!.value = v;
}
// the stance div is `TEXT<small>`, so firstChild must exist before first render
registry.get('stance')!.firstChild = { nodeValue: 'FAIR' };

const documentStub = {
  getElementById: (id: string) => registry.get(id) ?? null,
  createElement: (tag: string) => new El(tag),
};

const host: Record<string, any> = { document: documentStub };
host.window = host;
// the UI asks about reduced-motion and schedules count-up frames; stub both so the
// ceremony code runs headless instead of being skipped by the test
host.matchMedia = () => ({ matches: true });
host.requestAnimationFrame = (fn: () => void) => fn();
host.setTimeout = (fn: () => void) => fn();

// block 1: the sim bundle. block 2: the UI.
new Function('globalThis', 'document', scripts[0])(host, documentStub);
new Function(
  'globalThis',
  'document',
  'WF',
  'window',
  'requestAnimationFrame',
  scripts[1],
)(host, documentStub, host.WF, host, host.requestAnimationFrame);

// ── drive a full quarter through the real handlers ─────────────────────────────
const run = registry.get('btnRun')!;
const cardsHost = registry.get('cards')!;
let weeks = 0;
while (!run.disabled && weeks < 40) {
  // pick the first offered card by firing its click handler
  const first = cardsHost.children[0];
  if (first) first.click();
  registry.get('dGacha')!.value = String(30 + ((weeks * 13) % 150));
  registry.get('dGacha')!.input();
  run.click();
  registry.get('btnClose')!.click();
  weeks++;
}
if (weeks >= 40) throw new Error('quarter never ended');

const label = registry.get('weekLabel')!.textContent;
const qlabel = registry.get('qlabel')!.textContent;
console.log(`UI smoke OK — ${weeks} weeks driven, ${label}, ${qlabel}`);

// the verdict path must also render without throwing
registry.get('btnClose')!.click();
console.log(`verdict sheet: ${registry.get('sheetTitle')!.textContent}`);
