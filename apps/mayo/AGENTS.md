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

In-app purchases are scaffolded but **off by default** — see `src/payments/`. The provider is a
local mock until a real IAP library is added in a dev build (Expo Go can't do StoreKit). Flip
`EXPO_PUBLIC_PAYMENTS` to enable the flow; see the payments README.
