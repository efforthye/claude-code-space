// Provider selection. Today this always returns the mock provider (works in
// Expo Go). To go live, add a real provider in a **dev build** and select it
// here — Expo Go cannot load StoreKit / Play Billing native modules, so do NOT
// import a native IAP library at module scope in the Expo Go build.
//
// Recommended real options (dev build only):
//   - RevenueCat: `react-native-purchases` (cross-store entitlements + receipt
//     validation handled server-side) — usually the least work.
//   - `react-native-iap`: direct StoreKit / Play Billing, validate receipts
//     yourself against the mayo-api billing endpoints.
//
// Sketch once a real provider file exists:
//   if (PAYMENTS_MODE === 'revenuecat') return new RevenueCatProvider();

import { MockPaymentProvider } from './mock-provider';
import type { PaymentProvider } from './types';

export const PAYMENTS_MODE = process.env.EXPO_PUBLIC_PAYMENTS ?? 'mock';

export function getPaymentProvider(): PaymentProvider {
  // switch (PAYMENTS_MODE) { case 'revenuecat': ...; case 'iap': ...; }
  return new MockPaymentProvider();
}
