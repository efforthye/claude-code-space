import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { translate, type ActiveLang, type Lang } from '@/i18n/translations';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

type TFn = (key: string, params?: Record<string, string | number>) => string;

type SettingsValue = {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  scheme: Scheme;
  lang: Lang;
  setLang: (l: Lang) => void;
  activeLang: ActiveLang;
  defaultTierId: string;
  setDefaultTier: (id: string) => void;
  t: TFn;
};

const DEFAULT_TIER = 'standard';

const SettingsContext = createContext<SettingsValue | null>(null);
const STORAGE_KEY = 'mayo.settings.v1';

function deviceLang(): ActiveLang {
  try {
    const loc = new Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    return loc.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [lang, setLangState] = useState<Lang>('system');
  const [defaultTierId, setDefaultTierState] = useState<string>(DEFAULT_TIER);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as {
            themeMode?: ThemeMode;
            lang?: Lang;
            defaultTierId?: string;
          };
          if (parsed.themeMode) setThemeModeState(parsed.themeMode);
          if (parsed.lang) setLangState(parsed.lang);
          if (parsed.defaultTierId) setDefaultTierState(parsed.defaultTierId);
        } catch {
          // ignore malformed settings
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: { themeMode?: ThemeMode; lang?: Lang; defaultTierId?: string }) => {
    const data = { themeMode, lang, defaultTierId, ...next };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  };

  const setThemeMode = (m: ThemeMode) => {
    setThemeModeState(m);
    persist({ themeMode: m });
  };
  const setLang = (l: Lang) => {
    setLangState(l);
    persist({ lang: l });
  };
  const setDefaultTier = (id: string) => {
    setDefaultTierState(id);
    persist({ defaultTierId: id });
  };

  const scheme: Scheme = themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;
  const activeLang: ActiveLang = lang === 'system' ? deviceLang() : lang;
  const t = useMemo<TFn>(() => (key, params) => translate(activeLang, key, params), [activeLang]);

  const value: SettingsValue = {
    themeMode,
    setThemeMode,
    scheme,
    lang,
    setLang,
    activeLang,
    defaultTierId,
    setDefaultTier,
    t,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

export function useI18n() {
  const { t, lang, setLang } = useSettings();
  return { t, lang, setLang };
}
