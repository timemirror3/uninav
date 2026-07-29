const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
  action?: string;
  hostname?: string;
}

/**
 * Server-side Turnstile verification. Runs on every submission, without
 * exception — the client-side widget is a convenience, not a control.
 *
 * Fails closed: a missing secret, a network error, or a malformed response all
 * return false. On a site whose forms are forwarded by email, letting an
 * unverified submission through because the check errored is the wrong default.
 */
export async function verifyTurnstile(
  token: string,
  secret: string | undefined,
  remoteIp?: string | null
): Promise<boolean> {
  if (!secret || !token) return false;

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!response.ok) return false;
    const result = (await response.json()) as SiteverifyResponse;
    return result.success === true;
  } catch {
    return false;
  }
}

/** The client IP as Cloudflare reports it. */
export function clientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}
