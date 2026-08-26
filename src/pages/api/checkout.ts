import type { APIRoute } from 'astro';
import { getEnv, requireEnv } from '../../lib/env';
import { checkoutSchema } from '../../lib/schemas';
import { PRODUCTS } from '../../lib/products';
import { REFUND_ACK_TEXT, SITE } from '../../lib/site';
import {
  STATEMENT_DESCRIPTOR,
  paymentMethodTypes,
  priceIdFor,
  stripeClient,
} from '../../lib/stripe';

export const prerender = false;

/**
 * Creates a Stripe Checkout Session and 303s the browser to it.
 *
 * The request carries a product *slug* and nothing else about money. The amount
 * comes from the Stripe Price object named by an environment variable, so a
 * tampered form cannot change what is charged.
 *
 * Accepts both a form POST (the purchase rail's no-JS path) and JSON.
 */
export const POST: APIRoute = async (context) => {
  const env = getEnv();

  let raw: Record<string, unknown>;
  const contentType = context.request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      raw = (await context.request.json()) as Record<string, unknown>;
    } else {
      const form = await context.request.formData();
      raw = {
        product: form.get('product'),
        // Checkbox arrives as the string "true" (or is absent entirely).
        refundAck: form.get('refundAck') === 'true' || form.get('refundAck') === 'on',
        refundAckAt: form.get('refundAckAt') || new Date().toISOString(),
        email: form.get('email') ?? '',
      };
    }
  } catch {
    return fail(context.request, 'invalid_request');
  }

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    // A failure here is almost always the acknowledgement gate — send them back
    // to the product page rather than showing a JSON error.
    const slug = typeof raw['product'] === 'string' ? raw['product'] : '';
    return fail(context.request, 'acknowledgement_required', slug);
  }

  const product = PRODUCTS[parsed.data.product];

  try {
    const stripe = stripeClient(requireEnv(env, 'STRIPE_SECRET_KEY'));
    const priceId = priceIdFor(env, product.priceEnv);
    const origin = new URL(context.request.url).origin;

    /**
     * The acknowledgement and its timestamp are chargeback evidence. They ride
     * in Session metadata so they are attached to the payment record itself, not
     * merely rendered on a page the customer saw once.
     */
    const metadata: Record<string, string> = {
      product_slug: product.slug,
      product_name: product.name,
      refund_policy_acknowledged: 'true',
      refund_policy_acknowledged_at: parsed.data.refundAckAt,
      refund_policy_text: REFUND_ACK_TEXT.slice(0, 500),
      is_rush: product.isRush ? 'true' : 'false',
    };

    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: paymentMethodTypes(product.allowAch),

      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: product.testOnly ? `${origin}/` : `${origin}/services/${product.slug}`,

      billing_address_collection: 'required',
      ...(parsed.data.email ? { customer_email: parsed.data.email } : {}),
      // Always create a Customer so the portal has something to manage and
      // subscription renewals are attributable.
      customer_creation: product.mode === 'payment' ? 'always' : undefined,

      metadata,
      ...(product.mode === 'subscription'
        ? {
            subscription_data: {
              metadata,
              description: `${product.name} — renews quarterly`,
            },
          }
        : {
            payment_intent_data: {
              // Shows on the customer's statement and on Stripe's receipt.
              description: product.name,
              statement_descriptor: STATEMENT_DESCRIPTOR,
              metadata,
            },
          }),

      /**
       * Stripe Tax is deliberately NOT enabled.
       *
       * California generally exempts professional consulting services where no
       * tangible product changes hands, so switching Tax on would cost 0.5% per
       * transaction to collect tax that most likely is not owed. Flagged in
       * CONTENT-REVIEW.md as a question for the owner's CPA. To enable after
       * that confirmation, uncomment both lines:
       *
       *   automatic_tax: { enabled: true },
       *   customer_update: { address: 'auto' },
       */

      consent_collection: { terms_of_service: 'none' },
      custom_text: {
        submit: {
          message: `You have accepted the ${SITE.name} refund policy. Admission to any college or university cannot be guaranteed.`,
        },
      },
    });

    if (!session.url) {
      console.error('[checkout] session created without a url', session.id);
      return fail(context.request, 'stripe_error', product.slug);
    }

    // JSON callers get the URL; form posts get the redirect.
    if (contentType.includes('application/json')) {
      return new Response(JSON.stringify({ ok: true, url: session.url }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    return new Response(null, {
      status: 303,
      headers: { location: session.url, 'cache-control': 'no-store' },
    });
  } catch (error) {
    // Never log the customer email or any submitted value.
    console.error(
      '[checkout] failed for',
      product.slug,
      error instanceof Error ? error.message : 'unknown error'
    );
    return fail(context.request, 'stripe_error', product.slug);
  }
};

/** Send the visitor back to the product page with an error marker. */
function fail(request: Request, reason: string, slug = ''): Response {
  const accepts = request.headers.get('accept') ?? '';
  if (accepts.includes('application/json')) {
    return new Response(JSON.stringify({ ok: false, error: reason }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  // A testOnly product (the footer hot dog) has no /services/<slug> page, and an
  // unknown slug never did — either would 404. Send both to a page that exists.
  const product = slug ? PRODUCTS[slug as keyof typeof PRODUCTS] : undefined;
  const target = product
    ? product.testOnly
      ? `/?error=${reason}`
      : `/services/${slug}?error=${reason}`
    : `/services?error=${reason}`;
  return new Response(null, {
    status: 303,
    headers: { location: target, 'cache-control': 'no-store' },
  });
}
