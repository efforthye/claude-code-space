# Design rules (owner directives)

- **No emoji anywhere in the product** — not as icons, not in stat labels, not in
  notification titles or share copy. Use Ionicons for icons and plain text for
  labels. (Owner: "아이콘 이모지로 넣지 마, 앞으로도.")

# Expo SDK 54

This app is pinned to **Expo SDK 54** so it runs in the App Store **Expo Go** (SDK 55 & 57 are
stuck in Apple review; the store Expo Go supports SDK 54). Read the versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing native/config code. To move off Expo Go
(newer SDK or native modules), switch to a development build — see wiki `concepts/expo-go-vs-dev-build`.

## Backend

The app talks to **mayo-api** (`apps/mayo-api/`) via `src/api/client.ts`. Base URL comes from
`EXPO_PUBLIC_MAYO_API_URL` (see `.env.example`), defaulting to the home server on `:8001`. Data
fetching uses the small `useQuery` hook (`src/hooks/use-query.ts`); the catalog (tiers/durations/
plans) has a bundled fallback in `src/api/catalog.ts` so forms render even if the API is offline.
Keep the wire types in `src/api/types.ts` in sync with the server's `app/schemas.py`.

## Payments

In-app purchases are scaffolded but **not available** — see `src/payments/`. The provider reports
no products and refuses purchases, so the plan screen says so. It replaced a mock that granted the
plan after a simulated store sheet: no money moved, but the app believed you had paid and unlocked
whatever the plan gated. A real provider (RevenueCat / react-native-iap) needs a dev build, since
Expo Go can't load StoreKit — MAYO-11, blocked on the Apple renewal. Web has no IAP at all; card
payments there go through the API's Stripe checkout.
