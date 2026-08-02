import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';
import { inquirySchema } from '../../lib/schemas';
import { clientIp, verifyTurnstile } from '../../lib/turnstile';
import {
  inquiryNotification,
  internalInbox,
  newsletterNotification,
  sendEmail,
} from '../../lib/email';

export const prerender = false;

/**
 * Request for Information endpoint.
 *
 * This payload routinely describes a minor — birthdate, address, school,
 * first-generation status, U.S. military status. Consequently:
 *   - nothing is persisted anywhere; the submission is emailed and discarded
 *   - no field value is ever written to a log, including on failure paths
 *   - the newsletter opt-in is sent as its own message so the separate consent
 *     is visible as separate
 */
export const POST: APIRoute = async (context) => {
  const env = getEnv();

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  const parsed = inquirySchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        error: 'validation_failed',
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      },
      400
    );
  }

  const verified = await verifyTurnstile(
    parsed.data.turnstileToken,
    env.TURNSTILE_SECRET,
    clientIp(context.request)
  );
  if (!verified) {
    return json({ ok: false, error: 'verification_failed' }, 403);
  }

  const { turnstileToken: _token, ...inquiry } = parsed.data;

  const message = inquiryNotification(inquiry);
  const result = await sendEmail(env, {
    to: internalInbox(env),
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: inquiry.email,
  });

  if (!result.ok) {
    console.error('[inquiry] delivery failed:', result.error);
    return json({ ok: false, error: 'delivery_failed' }, 502);
  }

  // Separate message, separate consent. A failure here must not fail the
  // inquiry — the family has done their part either way.
  if (inquiry.consent) {
    const optIn = newsletterNotification(inquiry.email);
    const optInResult = await sendEmail(env, {
      to: internalInbox(env),
      subject: optIn.subject,
      html: optIn.html,
      text: optIn.text,
    });
    if (!optInResult.ok) {
      console.error('[inquiry] newsletter opt-in notice failed:', optInResult.error);
    }
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
