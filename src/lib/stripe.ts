import Stripe from 'stripe';
import type { Env } from './env';

/**
 * Stripe client configured for Workers.
 *
 * `httpClient` must be the fetch client — the default Node HTTP client does not
 * exist in workerd. This is separate from `nodejs_compat`, which is required for
 * the SDK's other Node imports.
 */
export function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    // Explicit so an SDK upgrade cannot silently change API behaviour.
    apiVersion: '2026-06-24.dahlia',
    appInfo: {
      name: 'University Navigator, Inc.',
      url: 'https://universitynavigator.org',
    },
  });
}

/**
 * A legible statement descriptor.
 *
 * Cryptic descriptors are a leading cause of "I don't recognise this charge"
 * disputes. Stripe allows 5–22 characters, letters/numbers/spaces only.
 */
export const STATEMENT_DESCRIPTOR = 'UNIV NAVIGATOR';

/** Resolve a product's Stripe Price ID from the environment. */
export function priceIdFor(env: Env, priceEnvKey: string): string {
  const priceId = env[priceEnvKey];
  if (!priceId) {
    throw new Error(
      `Missing ${priceEnvKey}. Create the Price in Stripe and set the ID — see README.md.`
    );
  }
  return priceId;
}

/**
 * Payment methods for a product.
 *
 * ACH costs 0.8% capped at $5 against a card's 2.9% + $0.30 — roughly $5 versus
 * $80 on a $2,750 quarterly renewal, so the bundle offers it and lists it first.
 *
 * ACH is deliberately NOT offered on essay products: it settles in days, and the
 * site advertises a 72-hour turnaround starting "at submission and payment".
 * Accepting ACH there would put us in breach of a written promise before work
 * even began. Rush is card-only for the same reason, more acutely.
 */
export function paymentMethodTypes(allowAch: boolean): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  return allowAch ? ['us_bank_account', 'card'] : ['card'];
}

/** Format a Stripe minor-unit amount for display, e.g. 275000 → "$2,750.00". */
export function formatAmount(amount: number | null | undefined, currency = 'usd'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
