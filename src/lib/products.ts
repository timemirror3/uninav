/**
 * Canonical product catalog.
 *
 * Prices here are for DISPLAY ONLY. The amount charged always comes from the
 * Stripe Price object referenced by `priceEnv` — the browser never supplies an
 * amount, and /api/checkout never accepts one.
 *
 * Keep these in step with the Stripe Dashboard; a mismatch between the displayed
 * price and the Price object is a consumer-protection problem, not a cosmetic one.
 */

export type ProductSlug =
  | 'counseling-bundle'
  | 'essay-review'
  | 'essay-reviews-5'
  | 'zoom-followups-5'
  | 'rush-consultation'
  | 'hotdog';

export interface Product {
  slug: ProductSlug;
  /** Env var holding the Stripe Price ID. Never a hardcoded price. */
  priceEnv: string;
  name: string;
  /** Uppercase eyebrow shown above the title. */
  kind: string;
  price: string;
  term: string;
  /** Line under the price in the purchase rail. */
  billingNote: string;
  /** Line under the total in the order summary. */
  termNote: string;
  cta: string;
  /** One-line summary used in order summaries and email. */
  desc: string;
  mode: 'payment' | 'subscription';
  /**
   * Whether ACH Direct Debit is offered.
   *
   * ACH is 0.8% capped at $5 versus 2.9% + $0.30 on cards — roughly $5 against
   * $80 on a $2,750 renewal, so the bundle presents it first. But ACH settles in
   * days, and the essay turnaround is advertised as starting "at submission and
   * payment". Offering ACH there would break a promise the site makes in writing,
   * so essay products and rush stay card-only.
   */
  allowAch: boolean;
  /** Rush carries a response clock the other products do not. */
  isRush?: boolean;
  /**
   * A live-payment smoke test, not a service. Kept out of the services
   * structured data and given no product page; the footer offers it and the
   * cancel URL falls back to the home page. Refund from the Stripe Dashboard.
   */
  testOnly?: boolean;
}

export const PRODUCTS: Record<ProductSlug, Product> = {
  'counseling-bundle': {
    slug: 'counseling-bundle',
    priceEnv: 'STRIPE_PRICE_COUNSELING_BUNDLE',
    name: 'University Counseling Bundle',
    kind: 'QUARTERLY SUBSCRIPTION',
    price: '$2,750.00',
    term: 'every 3 months',
    billingNote: 'Renews quarterly via Stripe. Cancel anytime before renewal.',
    termNote: 'Recurring — renews every 3 months until cancelled.',
    cta: 'Continue to checkout',
    desc: 'All-in-one quarterly counseling subscription.',
    mode: 'subscription',
    allowAch: true,
  },
  'essay-review': {
    slug: 'essay-review',
    priceEnv: 'STRIPE_PRICE_ESSAY_REVIEW',
    name: '1 Application / Essay Review',
    kind: 'ONE-TIME',
    price: '$300.00',
    term: 'one-time',
    billingNote: 'One-time payment via Stripe Checkout.',
    termNote: 'One-time charge.',
    cta: 'Continue to checkout',
    desc: 'One full essay review, 72-hour turnaround.',
    mode: 'payment',
    allowAch: false,
  },
  'essay-reviews-5': {
    slug: 'essay-reviews-5',
    priceEnv: 'STRIPE_PRICE_ESSAY_REVIEWS_5',
    name: '5 Additional Application / Essay Reviews',
    kind: 'ONE-TIME ADD-ON',
    price: '$775.00',
    term: 'one-time',
    billingNote: 'One-time payment via Stripe Checkout.',
    termNote: 'One-time charge.',
    cta: 'Continue to checkout',
    desc: 'Five additional full essay reviews.',
    mode: 'payment',
    allowAch: false,
  },
  'zoom-followups-5': {
    slug: 'zoom-followups-5',
    priceEnv: 'STRIPE_PRICE_ZOOM_FOLLOWUPS_5',
    name: 'Five Additional Zoom Follow-Ups',
    kind: 'ONE-TIME ADD-ON',
    price: '$725.00',
    term: 'one-time',
    billingNote: 'One-time payment via Stripe Checkout.',
    termNote: 'One-time charge.',
    cta: 'Continue to checkout',
    desc: 'Five additional Zoom sessions.',
    mode: 'payment',
    allowAch: true,
  },
  'rush-consultation': {
    slug: 'rush-consultation',
    priceEnv: 'STRIPE_PRICE_RUSH_CONSULTATION',
    name: 'Rush consultation fee',
    kind: 'ONE-TIME ADD-ON',
    price: '$100.00',
    term: 'one-time',
    billingNote: 'One-time payment via Stripe Checkout. Paid at booking.',
    termNote: 'One-time charge.',
    cta: 'Continue to checkout',
    desc: 'Rush consultation — scheduled outside current availability.',
    mode: 'payment',
    allowAch: false,
    isRush: true,
  },
  hotdog: {
    slug: 'hotdog',
    priceEnv: 'STRIPE_PRICE_HOTDOG',
    name: 'Hot dog (live payment test)',
    kind: 'PAYMENT TEST',
    price: '$1.00',
    term: 'one-time',
    billingNote: 'One-time $1.00 test charge via Stripe Checkout.',
    termNote: 'One-time charge.',
    cta: 'Buy a hot dog',
    desc: 'A $1.00 live payment test. No hot dog is shipped; refund on request.',
    mode: 'payment',
    allowAch: false,
    testOnly: true,
  },
};

export const PRODUCT_SLUGS = Object.keys(PRODUCTS) as ProductSlug[];

export function isProductSlug(value: unknown): value is ProductSlug {
  return typeof value === 'string' && value in PRODUCTS;
}

export function getProduct(slug: string): Product | undefined {
  return isProductSlug(slug) ? PRODUCTS[slug] : undefined;
}

/**
 * Response commitment for rush purchases, in hours.
 *
 * Rush is bought on the site and scheduled by a human afterward, so someone has
 * paid a premium for speed and is now waiting on an inbox. The thank-you page and
 * welcome email state this specific number instead of the generic one-business-day
 * line. Editable without a deploy via the RUSH_RESPONSE_HOURS env var.
 */
export const DEFAULT_RUSH_RESPONSE_HOURS = 24;

export function rushResponseHours(env?: Record<string, unknown>): number {
  const raw = env?.['RUSH_RESPONSE_HOURS'] ?? import.meta.env['RUSH_RESPONSE_HOURS'];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RUSH_RESPONSE_HOURS;
}
