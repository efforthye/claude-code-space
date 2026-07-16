// Payment abstraction — app-native in-app purchases (StoreKit / Play Billing).
//
// Real IAP needs native modules that DON'T run in Expo Go, so the app codes
// against this interface and ships a mock provider today. A dev build swaps in a
// real provider (RevenueCat / react-native-iap) behind the same interface — see
// src/payments/provider.ts.

export type EntitlementSource = 'none' | 'mock' | 'appstore' | 'playstore';

/** What the user is currently entitled to (their active plan). */
export type Entitlement = {
  planId: string; // 'free' | 'pro' | 'studio' | …
  source: EntitlementSource;
  activeUntil: string | null; // ISO date, or null for non-expiring / mock
};

export const FREE_ENTITLEMENT: Entitlement = {
  planId: 'free',
  source: 'none',
  activeUntil: null,
};

/** A purchasable store product, mapped to a subscription plan. */
export type Product = {
  id: string; // store product id, e.g. 'im.mayo.pro.monthly'
  planId: string;
  priceLabel: string; // e.g. '$19/mo'
};

export type PurchaseResult = {
  ok: boolean;
  canceled?: boolean;
  error?: string;
  entitlement?: Entitlement;
};

export interface PaymentProvider {
  readonly id: string;
  /** False when the store isn't reachable (e.g. real IAP in Expo Go). */
  readonly isAvailable: boolean;
  getProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  /** Re-check store entitlements (e.g. after reinstall). Null = nothing found. */
  restore(): Promise<Entitlement | null>;
}
