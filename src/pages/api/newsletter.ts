import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';
import { newsletterSchema } from '../../lib/schemas';
import { clientIp, verifyTurnstile } from '../../lib/turnstile';
import { internalInbox, newsletterNotification, sendEmail } from '../../lib/email';

export const prerender = false;

/**
 * Newsletter opt-in endpoint.
 *
 * Kept separate from the inquiry endpoint on purpose: the opt-in is a distinct
 * consent, and mixing it into the inquiry payload would make it impossible to
 * show that it was given separately.
 */
export const POST: APIRoute = async (context) => {
  const env = getEnv(context);

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  const parsed = newsletterSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ ok: false, error: 'validation_failed' }, 400);
  }

  const verified = await verifyTurnstile(
    parsed.data.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    clientIp(context.request)
  );
  if (!verified) {
    return json({ ok: false, error: 'verification_failed' }, 403);
  }

  const message = newsletterNotification(parsed.data.email);
  const result = await sendEmail(env, {
    to: internalInbox(env),
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: parsed.data.email,
  });

  if (!result.ok) {
    console.error('[newsletter] delivery failed:', result.error);
    return json({ ok: false, error: 'delivery_failed' }, 502);
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
