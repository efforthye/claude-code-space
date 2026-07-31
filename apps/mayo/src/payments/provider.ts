// Provider selection.
//
// There is no working provider yet, and the app says so rather than pretending.
// Until 2026-08-01 this returned a mock that granted the plan after a 600ms
// fake store sheet — no money moved, but the app believed you had paid, showed
// you as a Pro subscriber, and unlocked whatever the plan gated. That is the
// most damaging kind of fake: it is indistinguishable from a real purchase
// until a real one is attempted.
//
// Real IAP needs native modules that do NOT run in Expo Go, so this can only
// arrive with a development build (see wiki `concepts/expo-go-vs-dev-build`
// and MAYO-11, which is blocked on the Apple Developer renewal):
//   - RevenueCat: `react-native-purchases` — cross-store entitlements and
//     server-side receipt validation, usually the least work.
//   - `react-native-iap`: direct StoreKit / Play Billing, with receipts
//     validated against the mayo-api billing endpoints.
//
// Web has no IAP at all; card payments there go through the Stripe checkout the
// API already exposes, not through this interface.

import { UnavailablePaymentProvider } from './unavailable-provider';
import type { PaymentProvider } from './types';

export const PAYMENTS_MODE = process.env.EXPO_PUBLIC_PAYMENTS ?? 'none';

export function getPaymentProvider(): PaymentProvider {
  // switch (PAYMENTS_MODE) { case 'revenuecat': ...; case 'iap': ...; }
  return new UnavailablePaymentProvider();
}
