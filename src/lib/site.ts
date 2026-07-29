import { SITE_URL } from './site-url.mjs';

export const SITE = {
  url: SITE_URL,
  name: 'University Navigator, Inc.',
  shortName: 'University Navigator',
  tagline: 'Every college is within your reach.',
  description:
    'Independent college admissions consulting in Southern California. From first draft to acceptance letter, we help students see not just where they can go, but who they can become.',
  email: 'info@universitynavigator.org',
  phone: '(424) 404-3686',
  phoneHref: 'tel:+14244043686',
  region: 'Southern California',
  founded: '2026',
} as const;

/**
 * Compass bearings, read verbatim from the prototype's `bearings` map. The
 * needle rotates to `bearing + min(40, scrollY / 30)`.
 *
 * `/services/rush-consultation` has no prototype counterpart — it is required so
 * rush passes through the same refund-acknowledgement gate as the other four
 * products. 80° places it in the services arc, after zoom-followups-5 (74°) and
 * before about (87°).
 */
export const BEARINGS: Record<string, number> = {
  '/': 0,
  '/services': 41,
  '/services/counseling-bundle': 49,
  '/services/essay-review': 58,
  '/services/essay-reviews-5': 66,
  '/services/zoom-followups-5': 74,
  '/services/rush-consultation': 80,
  '/about': 87,
  '/book': 122,
  '/contact': 164,
  '/inquiry': 203,
  '/checkout': 231,
  '/policies/refunds': 245,
  '/policies/scope': 262,
  '/policies/privacy': 279,
  '/policies/terms': 296,
  '/thank-you': 318,
};

/** Section labels, read verbatim from the prototype's `labels` map. */
export const BEARING_LABELS: Record<string, string> = {
  '/': 'HOME',
  '/services': 'SERVICES',
  '/services/counseling-bundle': 'SERVICES',
  '/services/essay-review': 'SERVICES',
  '/services/essay-reviews-5': 'SERVICES',
  '/services/zoom-followups-5': 'SERVICES',
  '/services/rush-consultation': 'SERVICES',
  '/about': 'ABOUT',
  '/book': 'BOOK',
  '/contact': 'CONTACT',
  '/inquiry': 'INQUIRY',
  '/checkout': 'CHECKOUT',
  '/policies/refunds': 'POLICIES',
  '/policies/scope': 'POLICIES',
  '/policies/privacy': 'POLICIES',
  '/policies/terms': 'POLICIES',
  '/thank-you': 'CONFIRMED',
};

/** Resolve a pathname to its bearing + label, tolerating trailing slashes. */
export function bearingFor(pathname: string): { deg: number; label: string } {
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  const key = path.startsWith('/checkout') ? '/checkout' : path;
  return {
    deg: BEARINGS[key] ?? 0,
    label: BEARING_LABELS[key] ?? 'NOT FOUND',
  };
}

export const NAV_LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export const POLICY_LINKS = [
  { href: '/policies/refunds', label: 'Refund policy' },
  { href: '/policies/scope', label: 'Scope of services' },
  { href: '/policies/privacy', label: 'Privacy policy' },
  { href: '/policies/terms', label: 'Terms of service' },
] as const;

export const FOOTER_EXPLORE = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/book', label: 'Book a consultation' },
  { href: '/contact', label: 'Contact' },
  { href: '/inquiry', label: 'Request for Information' },
] as const;

/**
 * The refund policy, held as structured data because it has to appear in five
 * places verbatim: the services index, every service detail page, the standalone
 * policy page, the welcome email, and (as the acknowledgement text) in Stripe
 * Checkout metadata. A single source keeps the chargeback evidence consistent.
 */
export const REFUND_POLICY = {
  intro:
    'Refund requests must be submitted by email to info@universitynavigator.org and are subject to the following terms:',
  terms: [
    'Within 3 days of purchase: refund issued with a 10% service fee deducted.',
    'Within 7 days of purchase: refund issued with a 25% service fee deducted.',
    'After 7 days of purchase: no refunds will be issued, regardless of whether services have been used.',
    'No refunds if any work or consultations have taken place.',
  ],
} as const;

/** The exact sentence the customer ticks before checkout. Recorded in metadata. */
export const REFUND_ACK_TEXT =
  'I have read and accept the refund policy, including that no refunds are issued after 7 days of purchase or once any work or consultations have taken place.';

export const LEGAL_DISCLAIMER =
  'University Navigator, Inc. provides educational consulting services. Admission to any college or university cannot be guaranteed.';

export const CAMPUS_DISCLAIMER =
  'Campus photography is atmosphere, not a claim of affiliation or placement. Licensed images with attribution — see credits in the footer.';
