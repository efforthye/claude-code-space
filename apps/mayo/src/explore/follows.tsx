// Local "following" set for Explore (SNS-style follow). No accounts yet, so it
// lives on the device (AsyncStorage), like favorites.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type FollowsValue = {
  following: string[];
  isFollowing: (author: string) => boolean;
  toggle: (author: string) => void;
};

const FollowsContext = createContext<FollowsValue | null>(null);
const STORAGE_KEY = 'mayo.follows.v1';

export function FollowsProvider({ children }: { children: ReactNode }) {
  const [following, setFollowing] = useState<string[]>([]);

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

  const persist = (next: string[]) => {
    setFollowing(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const isFollowing = (author: string) => following.includes(author);
  const toggle = (author: string) => {
    if (!author) return;
    persist(isFollowing(author) ? following.filter((a) => a !== author) : [author, ...following]);
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
