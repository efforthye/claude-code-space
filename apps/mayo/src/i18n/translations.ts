// Lightweight i18n: per-locale string tables + translate() with {param} interpolation.
//
// Locale files live in ./locales. English is the base: it defines the key set,
// and any key a locale has not translated yet falls back to English rather than
// showing a raw key. That is what makes shipping a partially translated
// language safe.
//
// Adding a language:
//   1. add the code to ACTIVE_LANGS and LANG_NAMES in ./types
//   2. create locales/<code>.ts, copying en.ts and translating the values
//   3. register it in DICTS below
// Nothing else changes — the picker, device detection and fallback are generic.

import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { ptBR } from './locales/pt-BR';
import { zhHans } from './locales/zh-Hans';
import { zhHant } from './locales/zh-Hant';
import type { ActiveLang, Dict, Lang } from './types';

export { ACTIVE_LANGS, isRTL, LANG_NAMES, RTL_LANGS } from './types';
export type { ActiveLang, Dict, Lang } from './types';

/**
 * Registered dictionaries. A locale listed in ACTIVE_LANGS but absent here
 * falls back to English wholesale — which is the intended behaviour while a
 * translation is still being written.
 */
export const TRANSLATIONS: Partial<Record<ActiveLang, Dict>> = {
  en,
  ko,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  es,
  'pt-BR': ptBR,
  fr,
};

/**
 * Best supported locale for a device tag like `pt-BR`, `zh-Hant-TW`, `en-GB`.
 *
 * Matching is progressive: exact tag, then a few special cases, then the bare
 * language. Chinese cannot fall back on language alone — a Taiwanese reader
 * served 简体中文 is being served the wrong language — so the region picks the
 * script when the tag omits it.
 */
export function resolveDeviceLang(tag: string | null | undefined): ActiveLang {
  const raw = (tag || '').replace(/_/g, '-');
  if (!raw) return 'en';
  if (raw in TRANSLATIONS) return raw as ActiveLang;

  const parts = raw.split('-');
  const base = parts[0].toLowerCase();
  const rest = parts.slice(1).map((p) => p.toLowerCase());

  if (base === 'zh') {
    const hant = rest.some((p) => ['hant', 'tw', 'hk', 'mo'].includes(p));
    return hant ? 'zh-Hant' : 'zh-Hans';
  }
  if (base === 'pt') return 'pt-BR';
  // Indonesian's ISO-639-1 code was retired from `in` to `id`; some older
  // Android builds still report the old one.
  if (base === 'in') return 'id';

  if (base in TRANSLATIONS) return base as ActiveLang;
  return 'en';
}

export function translate(
  lang: ActiveLang,
  key: string,
  params?: Record<string, string | number>,
): string {
  let s = TRANSLATIONS[lang]?.[key] ?? en[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.split(`{${k}}`).join(String(params[k]));
    }
  }
  return s;
}
