# Payments (in-app purchases)

App-native purchases scaffolded so a real IAP provider can be dropped in later **without touching
the screens**. Everything is coded against `PaymentProvider` (`types.ts`); today a **mock**
implementation runs so the purchase UX works in **Expo Go** (which can't load StoreKit / Play
Billing native modules).

## Pieces
- `types.ts` — `PaymentProvider`, `Product`, `Entitlement`, `PurchaseResult`.
- `mock-provider.ts` — simulates the store flow; grants the entitlement locally.
- `provider.ts` — selects the provider (mock now). **The one place to swap in a real provider.**
- `context.tsx` — `PaymentsProvider` / `usePayments()`: current entitlement (persisted via
  AsyncStorage), products, `purchase()`, `selectFree()`, `restore()`, `isPro`.

## Wired into the UI
- **Plan modal** (`app/plan.tsx`) — lists plans, calls `purchase()` for paid tiers, `selectFree()`
  for the free tier, and offers **Restore purchases**; the current plan reflects the entitlement.
- **Account** — the plan card shows the live entitlement (name + tagline).

## Going live (dev build only)
Expo Go can't run IAP, so ship a **development build** and add a real provider in `provider.ts`,
gated on `EXPO_PUBLIC_PAYMENTS`:
- **RevenueCat** (`react-native-purchases`) — recommended; handles cross-store entitlements +
  server-side receipt validation.
- **`react-native-iap`** — direct StoreKit / Play Billing; validate receipts yourself against the
  mayo-api **`/v1/billing/validate`** endpoint (already stubbed) and record the entitlement.

Set store product ids to match `apps/mayo-api` (`im.mayo.<plan>.monthly`). Keep the mock as the
Expo Go / test path. No secrets in the repo — store keys/receipts stay in the secret store.
