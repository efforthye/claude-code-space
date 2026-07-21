// SAVED collection ("저장") for Explore — a local bookmark list (AsyncStorage),
// separate from likes: the heart talks to the server (one like per account,
// feeds the ranking), while saving is a private, device-local collection with
// no server side effects — like Instagram's bookmark.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { ExploreItem } from '@/api/types';

type FavoritesValue = {
  favorites: ExploreItem[];
  has: (id: string) => boolean;
  /** Toggle saved state (local only — likes are a separate action). */
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

  const toggle = async (item: ExploreItem): Promise<void> => {
    if (has(item.id)) persist(favorites.filter((f) => f.id !== item.id));
    else persist([item, ...favorites]);
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
