import type { APIRoute } from 'astro';
import { isProductSlug } from '../../lib/products';

export const prerender = false;

/**
 * /checkout/[product] — server-side redirect into the purchase flow.
 *
 * This route exists because the prototype had a /checkout screen with a faked
 * card form. That form is gone: raw card fields are never rendered on this site.
 *
 * Payment always starts from the product page, because that is where the
 * refund-policy acknowledgement gate lives and the acknowledgement must be
 * recorded before a Checkout Session exists. So a direct hit here is bounced to
 * the product page rather than silently creating a session with no
 * acknowledgement attached.
 */
export const GET: APIRoute = ({ params }) => {
  const product = params.product ?? '';
  const target = isProductSlug(product) ? `/services/${product}` : '/services';

  return new Response(null, {
    status: 303,
    headers: { location: target, 'cache-control': 'no-store' },
  });
};
