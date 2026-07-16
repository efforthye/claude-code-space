// Local "liked" collection for Explore. No accounts yet, so favorites live on the
// device (AsyncStorage). Liking also increments the server like count; unliking
// just removes it locally.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { likeExplore, unlikeExplore } from '@/api/client';
import type { ExploreItem } from '@/api/types';

type FavoritesValue = {
  favorites: ExploreItem[];
  has: (id: string) => boolean;
  /** Toggle like: one per device. Returns when the server call settles. */
  toggle: (item: ExploreItem) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);
const STORAGE_KEY = 'mayo.favorites.v1';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<ExploreItem[]>([]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (active && raw) setFavorites(JSON.parse(raw) as ExploreItem[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: ExploreItem[]) => {
    setFavorites(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const has = (id: string) => favorites.some((f) => f.id === id);

  const toggle = (item: ExploreItem): Promise<void> => {
    if (has(item.id)) {
      persist(favorites.filter((f) => f.id !== item.id));
      return unlikeExplore(item.id)
        .then(() => {})
        .catch(() => {});
    }
    persist([item, ...favorites]);
    return likeExplore(item.id)
      .then(() => {})
      .catch(() => {});
  };

  return (
    <FavoritesContext.Provider value={{ favorites, has, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
