// Account state for the whole app. Persists the session token (AsyncStorage) and
// exposes sign-in/up/out. Google sign-in goes through expo-auth-session (the app
// obtains an id_token, the backend verifies it) and is enabled only when
// EXPO_PUBLIC_GOOGLE_CLIENT_ID is configured.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authGoogle, authLogin, authLogout, authMe, authRegister } from '@/api/client';
import type { AuthUser } from '@/api/types';

import { setSessionToken } from './session';

const STORAGE_KEY = 'mayo.auth.v1';

export const GOOGLE_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();

type AuthValue = {
  user: AuthUser | null;
  /** True while the persisted session is being restored on launch. */
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Restore the persisted session and re-validate it against the server.
  useEffect(() => {
    let active = true;
    (async () => {
      // WEB: returning from the full-page Google OAuth redirect — the id_token
      // arrives in the URL fragment. Adopt it, then clean the URL.
      if (Platform.OS === 'web') {
        try {
          const g = globalThis as unknown as {
            location?: { hash: string; pathname: string; search: string };
            history?: { replaceState: (a: unknown, b: string, c: string) => void };
          };
          const hash = g.location?.hash ?? '';
          const m = hash.match(/[#&]id_token=([^&]+)/);
          if (m) {
            g.history?.replaceState(null, '', (g.location?.pathname ?? '/') + (g.location?.search ?? ''));
            const res = await authGoogle(decodeURIComponent(m[1]));
            setSessionToken(res.token);
            if (active) setUser(res.user);
            await AsyncStorage.setItem(STORAGE_KEY, res.token).catch(() => {});
            if (active) setRestoring(false);
            return;
          }
        } catch {
          // fall through to the normal session restore
        }
      }
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEY);
        if (token) {
          setSessionToken(token);
          const me = await authMe(); // throws if expired/invalid
          if (active) setUser(me);
        }
      } catch {
        setSessionToken('');
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const adopt = async (token: string, nextUser: AuthUser) => {
    setSessionToken(token);
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEY, token).catch(() => {});
  };

  const signIn = async (email: string, password: string) => {
    const res = await authLogin(email.trim(), password);
    await adopt(res.token, res.user);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await authRegister(email.trim(), password, name);
    await adopt(res.token, res.user);
  };

  const signInWithGoogle = async (idToken: string) => {
    const res = await authGoogle(idToken);
    await adopt(res.token, res.user);
  };

  const signOut = async () => {
    try {
      await authLogout();
    } catch {
      // session may already be gone server-side — sign out locally regardless
    }
    setSessionToken('');
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, restoring, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
