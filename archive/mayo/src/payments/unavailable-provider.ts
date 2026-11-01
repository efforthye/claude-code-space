// The honest provider: in-app purchase is not wired up, so nothing is for sale.
//
// It reports no products and refuses purchases, which makes the plan screen
// show its "not available yet" state instead of a buy button that would grant
// an entitlement nobody paid for.

import type { Entitlement, PaymentProvider, Product, PurchaseResult } from './types';

export class UnavailablePaymentProvider implements PaymentProvider {
  readonly id = 'unavailable';
  readonly isAvailable = false;

  async getProducts(): Promise<Product[]> {
    return [];
  }

  async purchase(): Promise<PurchaseResult> {
    return { ok: false, error: 'unavailable' };
  }

  async restore(): Promise<Entitlement | null> {
    return null;
  }
}
