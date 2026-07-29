import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getEnv, requireEnv, type Env } from '../../lib/env';
import { formatAmount, stripeClient } from '../../lib/stripe';
import { getProduct, rushResponseHours } from '../../lib/products';
import {
  internalInbox,
  internalPurchaseNotification,
  sendEmail,
  welcomeEmail,
  type PurchaseDetails,
} from '../../lib/email';

export const prerender = false;

/**
 * In-isolate replay guard.
 *
 * Stripe retries deliveries, and a retry must not re-send email. This covers the
 * common case (Stripe retrying within seconds while the isolate is warm) without
 * introducing a KV/D1 dependency the brief does not call for. It is deliberately
 * bounded so a long-lived isolate cannot grow it without limit.
 *
 * A retry landing on a cold isolate would resend — accepted, and noted in the
 * README, because the alternative is storage this build is not scoped to add.
 */
const processed = new Set<string>();
const MAX_TRACKED = 500;

function alreadyHandled(eventId: string): boolean {
  if (processed.has(eventId)) return true;
  if (processed.size >= MAX_TRACKED) {
    const oldest = processed.values().next().value;
    if (oldest) processed.delete(oldest);
  }
  processed.add(eventId);
  return false;
}

export const POST: APIRoute = async (context) => {
  const env = getEnv();

  const signature = context.request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = stripeClient(requireEnv(env, 'STRIPE_SECRET_KEY'));
    const secret = requireEnv(env, 'STRIPE_WEBHOOK_SECRET');

    // The raw body must be read as text BEFORE any parsing: signature
    // verification runs over the exact bytes Stripe signed.
    const rawBody = await context.request.text();

    // constructEventAsync, not constructEvent. The sync version uses Node's
    // crypto module and throws on Workers.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (error) {
    console.error(
      '[stripe-webhook] signature verification failed:',
      error instanceof Error ? error.message : 'unknown error'
    );
    return new Response('Invalid signature', { status: 400 });
  }

  if (alreadyHandled(event.id)) {
    return new Response(JSON.stringify({ received: true, deduped: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge everything else so Stripe stops retrying it.
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    await handleCompletedSession(env, event.data.object as Stripe.Checkout.Session);
  } catch (error) {
    console.error(
      '[stripe-webhook] handler error for',
      event.id,
      error instanceof Error ? error.message : 'unknown error'
    );
    // 500 tells Stripe to retry. The payment is already captured either way.
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

async function handleCompletedSession(
  env: Env,
  session: Stripe.Checkout.Session
): Promise<void> {
  const metadata = session.metadata ?? {};
  const slug = metadata['product_slug'] ?? '';
  const product = getProduct(slug);

  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? '';
  const customerName = session.customer_details?.name ?? '';

  const details: PurchaseDetails = {
    productName: product?.name ?? metadata['product_name'] ?? 'University Navigator service',
    productDesc: product?.desc ?? '',
    amount: formatAmount(session.amount_total, session.currency ?? 'usd'),
    customerName,
    customerEmail,
    isSubscription: session.mode === 'subscription',
    isRush: metadata['is_rush'] === 'true' || product?.isRush === true,
    rushResponseHours: rushResponseHours(env),
    acknowledgedAt: metadata['refund_policy_acknowledged_at'] ?? 'not recorded',
    portalUrl: env.STRIPE_PORTAL_URL,
  };

  /*
   * Two sends, two jobs:
   *
   *  1. The customer's welcome email — restates the refund policy verbatim,
   *     explains what happens next, and how to submit drafts. This is NOT a
   *     receipt; Stripe sends that separately and it must not be suppressed,
   *     because its invoice PDF is what customers file and what we rely on as
   *     dispute evidence.
   *
   *  2. The internal notification — the entire technical handoff to the person
   *     who does the scheduling. Rush is flagged urgent in the subject.
   *
   * Neither failure throws: the payment succeeded, and returning 500 would make
   * Stripe retry and duplicate whichever send did succeed.
   */

  if (customerEmail) {
    const message = welcomeEmail(details);
    const result = await sendEmail(env, {
      to: customerEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (!result.ok) {
      console.error('[stripe-webhook] welcome email failed:', result.error);
    }
  } else {
    console.error('[stripe-webhook] no customer email on session', session.id);
  }

  const internal = internalPurchaseNotification(details);
  const internalResult = await sendEmail(env, {
    to: internalInbox(env),
    subject: internal.subject,
    html: internal.html,
    text: internal.text,
    ...(customerEmail ? { replyTo: customerEmail } : {}),
  });
  if (!internalResult.ok) {
    console.error('[stripe-webhook] internal notification failed:', internalResult.error);
  }
}
