import type { APIContext } from 'astro';

/**
 * Typed accessor for runtime secrets.
 *
 * On Workers, secrets arrive on `locals.runtime.env`, not `process.env` or
 * `import.meta.env`. In `astro dev` they come from `.dev.vars` via the platform
 * proxy. This resolves both, so route code never has to care which it is running
 * under.
 */
export interface Env {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_COUNSELING_BUNDLE?: string;
  STRIPE_PRICE_ESSAY_REVIEW?: string;
  STRIPE_PRICE_ESSAY_REVIEWS_5?: string;
  STRIPE_PRICE_ZOOM_FOLLOWUPS_5?: string;
  STRIPE_PRICE_RUSH_CONSULTATION?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  PUBLIC_CAL_LINK?: string;
  INTERNAL_NOTIFY_EMAIL?: string;
  FROM_EMAIL?: string;
  RUSH_RESPONSE_HOURS?: string;
  STRIPE_PORTAL_URL?: string;
  [key: string]: string | undefined;
}

export function getEnv(context: APIContext | { locals: App.Locals }): Env {
  const runtimeEnv =
    (context.locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};

  // import.meta.env carries build-time values (and .env in dev); runtime env
  // wins because that is where deployed secrets live.
  return { ...(import.meta.env as unknown as Env), ...(runtimeEnv as Env) };
}

/** Read a required secret, throwing a clear error naming the missing key. */
export function requireEnv(env: Env, key: keyof Env & string): string {
  const value = env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. See .dev.vars.example and README.md.`
    );
  }
  return value;
}
