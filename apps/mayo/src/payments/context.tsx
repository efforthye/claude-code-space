// PaymentsProvider / usePayments — app-wide entitlement + purchase flow.
//
// Holds the current entitlement (persisted via AsyncStorage), the store
// products, and purchase/restore actions. No store is wired up yet, so the
// a real IAP provider slots in behind the same interface (see provider.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getPaymentProvider } from './provider';
import { FREE_ENTITLEMENT, type Entitlement, type Product, type PurchaseResult } from './types';

const STORAGE_KEY = 'mayo.entitlement.v1';

type PaymentsValue = {
  available: boolean;
  products: Product[];
  entitlement: Entitlement;
  isPro: boolean;
  purchasing: boolean;
  purchase: (productId: string) => Promise<PurchaseResult>;
  selectFree: () => void;
  restore: () => Promise<boolean>;
};

const PaymentsContext = createContext<PaymentsValue | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const providerRef = useRef(getPaymentProvider());
  const provider = providerRef.current;

  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (alive && raw) setEntitlement(JSON.parse(raw) as Entitlement);
      })
      .catch(() => {});
    provider
      .getProducts()
      .then((p) => {
        if (alive) setProducts(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [provider]);

  const persist = useCallback((next: Entitlement) => {
    setEntitlement(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const purchase = useCallback(
    async (productId: string): Promise<PurchaseResult> => {
      setPurchasing(true);
      try {
        const result = await provider.purchase(productId);
        if (result.ok && result.entitlement) persist(result.entitlement);
        return result;
      } finally {
        setPurchasing(false);
      }
    },
    [provider, persist],
  );

  const selectFree = useCallback(() => persist(FREE_ENTITLEMENT), [persist]);

  const restore = useCallback(async (): Promise<boolean> => {
    const restored = await provider.restore();
    if (restored) {
      persist(restored);
      return true;
    }
    return false;
  }, [provider, persist]);

  const value = useMemo<PaymentsValue>(
    () => ({
      available: provider.isAvailable,
      products,
      entitlement,
      isPro: entitlement.planId !== 'free',
      purchasing,
      purchase,
      selectFree,
      restore,
    }),
    [provider.isAvailable, products, entitlement, purchasing, purchase, selectFree, restore],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments(): PaymentsValue {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error('usePayments must be used within a PaymentsProvider');
  return ctx;
}
