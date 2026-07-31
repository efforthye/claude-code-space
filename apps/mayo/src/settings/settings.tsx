import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DEFAULT_API_KEY, setApiKey } from '@/api/api-key';
import { DEFAULT_API_BASE_URL, setApiBaseUrl } from '@/api/base-url';
import { resolveDeviceLang, translate, type ActiveLang, type Lang } from '@/i18n/translations';

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
  apiUrl: string;
  setApiUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  exploreAutoplay: boolean;
  setExploreAutoplay: (v: boolean) => void;
  notifyOnDone: boolean;
  setNotifyOnDone: (v: boolean) => void;
  /** Admin-only: preview the app as a normal (non-admin, free) user. */
  previewAsUser: boolean;
  setPreviewAsUser: (v: boolean) => void;
  t: TFn;
};

const DEFAULT_TIER = 'standard';

const SettingsContext = createContext<SettingsValue | null>(null);
const STORAGE_KEY = 'mayo.settings.v1';

function deviceLang(): ActiveLang {
  try {
    // resolvedOptions().locale gives the full BCP-47 tag (`zh-Hant-TW`,
    // `pt-BR`), which resolveDeviceLang needs to tell Chinese scripts apart.
    const loc = new Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    return resolveDeviceLang(loc);
  } catch {
    return 'en';
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [lang, setLangState] = useState<Lang>('system');
  const [defaultTierId, setDefaultTierState] = useState<string>(DEFAULT_TIER);
  const [apiUrl, setApiUrlState] = useState<string>(DEFAULT_API_BASE_URL);
  const [apiKey, setApiKeyState] = useState<string>(DEFAULT_API_KEY);
  const [exploreAutoplay, setExploreAutoplayState] = useState<boolean>(false);
  const [notifyOnDone, setNotifyOnDoneState] = useState<boolean>(true);
  const [previewAsUser, setPreviewAsUserState] = useState<boolean>(false);

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
            apiUrl?: string;
            apiKey?: string;
            exploreAutoplay?: boolean;
            notifyOnDone?: boolean;
            previewAsUser?: boolean;
          };
          if (parsed.themeMode) setThemeModeState(parsed.themeMode);
          if (parsed.lang) setLangState(parsed.lang);
          if (parsed.defaultTierId) setDefaultTierState(parsed.defaultTierId);
          if (typeof parsed.exploreAutoplay === 'boolean')
            setExploreAutoplayState(parsed.exploreAutoplay);
          if (typeof parsed.notifyOnDone === 'boolean') setNotifyOnDoneState(parsed.notifyOnDone);
          if (typeof parsed.previewAsUser === 'boolean') setPreviewAsUserState(parsed.previewAsUser);
          if (parsed.apiUrl) {
            setApiUrlState(parsed.apiUrl);
            setApiBaseUrl(parsed.apiUrl); // apply to the API client on launch
          }
          if (parsed.apiKey) {
            setApiKeyState(parsed.apiKey);
            setApiKey(parsed.apiKey); // apply to the API client on launch
          }
        } catch {
          // ignore malformed settings
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: {
    themeMode?: ThemeMode;
    lang?: Lang;
    defaultTierId?: string;
    apiUrl?: string;
    apiKey?: string;
    exploreAutoplay?: boolean;
    notifyOnDone?: boolean;
    previewAsUser?: boolean;
  }) => {
    const data = {
      themeMode,
      lang,
      defaultTierId,
      apiUrl,
      apiKey,
      exploreAutoplay,
      notifyOnDone,
      previewAsUser,
      ...next,
    };
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
  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    setApiBaseUrl(url); // apply immediately so the next request uses it
    persist({ apiUrl: url });
  };
  const setApiKeyValue = (key: string) => {
    setApiKeyState(key);
    setApiKey(key); // apply immediately so the next request is authenticated
    persist({ apiKey: key });
  };
  const setExploreAutoplay = (v: boolean) => {
    setExploreAutoplayState(v);
    persist({ exploreAutoplay: v });
  };
  const setNotifyOnDone = (v: boolean) => {
    setNotifyOnDoneState(v);
    persist({ notifyOnDone: v });
  };
  const setPreviewAsUser = (v: boolean) => {
    setPreviewAsUserState(v);
    persist({ previewAsUser: v });
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
    apiUrl,
    setApiUrl,
    apiKey,
    setApiKey: setApiKeyValue,
    exploreAutoplay,
    setExploreAutoplay,
    notifyOnDone,
    setNotifyOnDone,
    previewAsUser,
    setPreviewAsUser,
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
