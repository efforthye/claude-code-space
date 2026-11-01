"use client";

import { useSyncExternalStore } from "react";
import type { ShippingMethod } from "@/lib/domain/types";

/** 비회원 장바구니, 이 기기의 localStorage에만 저장된다. */
export type CartLine = { workId: string; shipping: ShippingMethod };

const KEY = "mayo.cart.v1";
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // private mode etc., the cart still works for this tab
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: CartLine[] = [];

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const cart = {
  add(line: CartLine) {
    write([...read().filter((l) => l.workId !== line.workId), line]);
  },
  remove(workId: string) {
    write(read().filter((l) => l.workId !== workId));
  },
  setShipping(workId: string, shipping: ShippingMethod) {
    write(read().map((l) => (l.workId === workId ? { ...l, shipping } : l)));
  },
  clear() {
    write([]);
  },
};
