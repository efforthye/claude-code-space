// Who you follow, for the Explore feed.
//
// Signed in, the list lives on the server (see store.FollowStore) so it is the
// same on every device and survives a reinstall. Signed out it stays on the
// device — and merges up on the first sign-in, because following someone before
// you have an account should not cost you that follow.
//
// The device copy is also the offline cache: the UI reads it synchronously and
// the server call reconciles behind it, so the button flips on tap rather than
// after a round trip.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { followAuthor, getFollowing, mergeFollowing, unfollowAuthor } from '@/api/client';
import { useAuth } from '@/auth/auth';

type FollowsValue = {
  following: string[];
  isFollowing: (author: string) => boolean;
  toggle: (author: string) => void;
};

const FollowsContext = createContext<FollowsValue | null>(null);
const STORAGE_KEY = 'mayo.follows.v1';

export function FollowsProvider({ children }: { children: ReactNode }) {
  const [following, setFollowing] = useState<string[]>([]);
  const { user } = useAuth();
  // Tracks which account we have already reconciled, so signing out and back in
  // merges again but a re-render does not.
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (active && raw) setFollowing(JSON.parse(raw) as string[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    setFollowing(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // On sign-in: hand the server whatever this device collected while signed
  // out, and take its list as the truth afterwards.
  useEffect(() => {
    if (!user) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;

    let active = true;
    (async () => {
      try {
        const local = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as string[];
        const server = local.length ? await mergeFollowing(local) : await getFollowing();
        if (active) persist(server);
      } catch {
        // Offline or the endpoint is unreachable: the device list still works,
        // and the next sign-in reconciles.
      }
    })();
    return () => {
      active = false;
    };
  }, [user, persist]);

  const isFollowing = (author: string) => following.includes(author);

  const toggle = (author: string) => {
    if (!author) return;
    const wasFollowing = isFollowing(author);
    const next = wasFollowing ? following.filter((a) => a !== author) : [author, ...following];
    // Optimistic: the tap is the answer, the server call is bookkeeping. A
    // follow button that waits for the network reads as broken.
    persist(next);
    if (!user) return;
    (wasFollowing ? unfollowAuthor(author) : followAuthor(author))
      .then((server) => persist(server))
      .catch(() => persist(wasFollowing ? [author, ...next] : next.filter((a) => a !== author)));
  };

  return (
    <FollowsContext.Provider value={{ following, isFollowing, toggle }}>
      {children}
    </FollowsContext.Provider>
  );
}

export function useFollows(): FollowsValue {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error('useFollows must be used within a FollowsProvider');
  return ctx;
}
