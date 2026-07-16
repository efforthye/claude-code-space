// Mock payment provider — simulates the IAP flow so the purchase UX works in
// Expo Go (no StoreKit/Billing). Grants the entitlement locally; the context
// persists it. Swapped for a real provider in a dev build (see provider.ts).

import { PLANS } from '@/api/catalog';

import type { Entitlement, PaymentProvider, Product, PurchaseResult } from './types';

const PURCHASABLE = PLANS.filter((p) => p.monthly > 0);

function productFor(planId: string): Product | undefined {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.monthly <= 0) return undefined;
  return { id: `mock.${plan.id}.monthly`, planId: plan.id, priceLabel: `$${plan.monthly}/mo` };
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly isAvailable = true;

  async getProducts(): Promise<Product[]> {
    return PURCHASABLE.map((p) => ({
      id: `mock.${p.id}.monthly`,
      planId: p.id,
      priceLabel: `$${p.monthly}/mo`,
    }));
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    await delay(600); // simulate the store sheet round-trip
    const planId = PURCHASABLE.map((p) => p.id).find((id) => productId.includes(id));
    if (!planId || !productFor(planId)) {
      return { ok: false, error: 'unknown product' };
    }
    const entitlement: Entitlement = { planId, source: 'mock', activeUntil: null };
    return { ok: true, entitlement };
  }

  async restore(): Promise<Entitlement | null> {
    // Nothing to restore from a store in mock mode; the context keeps the
    // locally-persisted entitlement across launches.
    return null;
  }
}
