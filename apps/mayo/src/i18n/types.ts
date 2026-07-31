/** Shared i18n types. Kept separate so locale files import no runtime code. */

export type Dict = Record<string, string>;

/**
 * Every locale mayo ships. Ordered as it appears in the language picker:
 * the user's likely languages first, then the rest alphabetically by endonym.
 */
export const ACTIVE_LANGS = [
  'en',
  'ko',
  'ja',
  'zh-Hans',
  'zh-Hant',
  'es',
  'pt-BR',
  'fr',
  'de',
  'id',
  'vi',
  'th',
  'hi',
  'ar',
  'ru',
] as const;

export type ActiveLang = (typeof ACTIVE_LANGS)[number];

/** What the user picked. `system` follows the device. */
export type Lang = 'system' | ActiveLang;

/**
 * Names are written in the language itself (endonyms), never translated.
 * A speaker looking for their language scans for its own name — "Korean"
 * in an English list is useless to someone who only reads 한국어.
 */
export const LANG_NAMES: Record<ActiveLang, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  de: 'Deutsch',
  id: 'Bahasa Indonesia',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  hi: 'हिन्दी',
  ar: 'العربية',
  ru: 'Русский',
};

/** Locales written right-to-left. Layout must mirror, not just the text. */
export const RTL_LANGS: readonly ActiveLang[] = ['ar'];

export const isRTL = (lang: ActiveLang): boolean => RTL_LANGS.includes(lang);
