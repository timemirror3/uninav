import { z } from 'zod';

/**
 * Shared validation. Imported by both the React islands (for client-side
 * mirroring) and the API routes (as the authoritative check).
 *
 * Every string is trimmed and length-capped. The caps are not cosmetic: an
 * uncapped field is an email-payload amplification vector, and these submissions
 * are forwarded by email.
 */

const shortText = z.string().trim().max(200);
const optionalShortText = shortText.optional().or(z.literal(''));

export const emailField = z
  .email('Enter a valid email address')
  .trim()
  .min(1, 'Email is required')
  .max(254);

export const turnstileField = z.string().min(1, 'Verification is required').max(4096);

/* -------------------------------------------------------------------------- */
/* Contact — 4 fields                                                          */
/* -------------------------------------------------------------------------- */

export const contactSchema = z.object({
  first: shortText.min(1, 'First name is required'),
  last: shortText.min(1, 'Last name is required'),
  email: emailField,
  msg: z.string().trim().min(1, 'Message is required').max(5000),
  turnstileToken: turnstileField,
});

export type ContactInput = z.infer<typeof contactSchema>;

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                  */
/* -------------------------------------------------------------------------- */

export const newsletterSchema = z.object({
  email: emailField,
  turnstileToken: turnstileField,
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;

/* -------------------------------------------------------------------------- */
/* Inquiry — 4 steps                                                           */
/* -------------------------------------------------------------------------- */

const yesNo = z.enum(['yes', 'no']).optional().or(z.literal(''));

/**
 * Step 1 · About you.
 *
 * Birthdate, first-generation status and U.S. military status are sensitive and
 * frequently describe a minor. They stay optional exactly as the prototype has
 * them, and their values are excluded from logs — see src/lib/log.ts.
 */
export const inquiryStep1 = z.object({
  firstName: shortText.min(1, 'First name is required'),
  lastName: shortText.min(1, 'Last name is required'),
  birthdate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
    .optional()
    .or(z.literal('')),
  firstGen: yesNo,
  military: yesNo,
});

/**
 * Step 2 · Contact.
 *
 * The prototype carries an inline note recommending street address be dropped in
 * favour of city/state. The client chose to ship as designed, so the fields stay.
 * Recorded in CONTENT-REVIEW.md; not acted on here.
 */
export const inquiryStep2 = z.object({
  email: emailField,
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  addr1: optionalShortText,
  addr2: optionalShortText,
  city: optionalShortText,
  state: optionalShortText,
  zip: z.string().trim().max(20).optional().or(z.literal('')),
});

export const inquiryStep3 = z.object({
  institution: optionalShortText,
  ceeb: z.string().trim().max(20).optional().or(z.literal('')),
  applyingAs: z.enum(['first-year', 'transfer']).optional().or(z.literal('')),
  entryTerm: optionalShortText,
});

export const inquiryStep4 = z.object({
  interest1: optionalShortText,
  interest2: optionalShortText,
  interest3: optionalShortText,
  /** Newsletter opt-in. Unchecked by default and separate from the inquiry. */
  consent: z.boolean().default(false),
});

export const inquirySchema = inquiryStep1
  .extend(inquiryStep2.shape)
  .extend(inquiryStep3.shape)
  .extend(inquiryStep4.shape)
  .extend({ turnstileToken: turnstileField });

export type InquiryInput = z.infer<typeof inquirySchema>;

/** Per-step schemas, indexed by step number, for client-side gating. */
export const INQUIRY_STEP_SCHEMAS = [
  inquiryStep1,
  inquiryStep2,
  inquiryStep3,
  inquiryStep4,
] as const;

/* -------------------------------------------------------------------------- */
/* Checkout                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Note what is absent: no amount, no price, no currency. The server resolves the
 * Stripe Price ID from the slug via environment variables, so a tampered request
 * cannot change what is charged.
 */
export const checkoutSchema = z.object({
  product: z.enum([
    'counseling-bundle',
    'essay-review',
    'essay-reviews-5',
    'zoom-followups-5',
    'rush-consultation',
    'hotdog',
  ]),
  /** Must be true — the refund-policy gate. */
  refundAck: z.literal(true),
  /** ISO timestamp of the acknowledgement, recorded as chargeback evidence. */
  refundAckAt: z.iso.datetime(),
  email: emailField.optional().or(z.literal('')),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Flatten a ZodError into `{ field: message }` for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
