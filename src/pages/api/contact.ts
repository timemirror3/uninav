import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';
import { contactSchema } from '../../lib/schemas';
import { clientIp, verifyTurnstile } from '../../lib/turnstile';
import { contactNotification, internalInbox, sendEmail } from '../../lib/email';

export const prerender = false;

/**
 * Contact form endpoint.
 *
 * Submissions are forwarded by email and never persisted — the privacy policy
 * promises exactly that. Field values are never logged: see the deliberate
 * absence of the submitted payload in every error path below.
 */
export const POST: APIRoute = async (context) => {
  const env = getEnv(context);

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    // Only the field names are reported back — never the values.
    return json(
      { ok: false, error: 'validation_failed', fields: parsed.error.issues.map((i) => i.path.join('.')) },
      400
    );
  }

  const verified = await verifyTurnstile(
    parsed.data.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    clientIp(context.request)
  );
  if (!verified) {
    return json({ ok: false, error: 'verification_failed' }, 403);
  }

  const message = contactNotification(parsed.data);
  const result = await sendEmail(env, {
    to: internalInbox(env),
    subject: message.subject,
    html: message.html,
    text: message.text,
    // So the office can reply straight to the sender.
    replyTo: parsed.data.email,
  });

  if (!result.ok) {
    // Log the transport failure only. The submission contents stay out of logs.
    console.error('[contact] delivery failed:', result.error);
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
