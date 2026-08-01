// In-app notification inbox — events (job finished/failed, publishes, …) pile up
// here so the user can review them later, with an unread badge on the My tab.
// Device-local (AsyncStorage), capped so it never grows unbounded.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type InboxItem = {
  id: string;
  icon: 'film' | 'alert' | 'cloud-upload' | 'megaphone';
  title: string;
  body: string;
  createdAt: number; // epoch ms
  read: boolean;
  /**
   * Where tapping this takes you. Without it a notification is a dead end: it
   * tells you the film is ready and then makes you go find it yourself.
   */
  href?: string;
};

type InboxValue = {
  items: InboxItem[];
  unread: number;
  add: (item: Omit<InboxItem, 'id' | 'createdAt' | 'read'>) => void;
  markAllRead: () => void;
  clear: () => void;
};

const InboxContext = createContext<InboxValue | null>(null);
const STORAGE_KEY = 'mayo.inbox.v1';
const MAX_ITEMS = 100;

export function InboxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (active && raw) setItems(JSON.parse(raw) as InboxItem[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: InboxItem[]) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const add: InboxValue['add'] = (item) => {
    const entry: InboxItem = {
      ...item,
      id: `n${Date.now()}-${seq.current++}`,
      createdAt: Date.now(),
      read: false,
    };
    setItems((prev) => {
      const next = [entry, ...prev].slice(0, MAX_ITEMS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const markAllRead = () => persist(items.map((i) => (i.read ? i : { ...i, read: true })));
  const clear = () => persist([]);

  const unread = items.reduce((n, i) => n + (i.read ? 0 : 1), 0);

  return (
    <InboxContext.Provider value={{ items, unread, add, markAllRead, clear }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within an InboxProvider');
  return ctx;
}
