import { env as workerEnv } from 'cloudflare:workers';

/**
 * Typed accessor for runtime secrets.
 *
 * Astro 6 removed `Astro.locals.runtime.env`; the supported access path is now
 * the `cloudflare:workers` virtual module, which works both in `astro dev` (via
 * the Cloudflare Vite plugin, reading `.dev.vars`) and on the deployed Worker.
 *
 * Only import this from code that runs on the server — modules with
 * `prerender = false` and the API routes. `cloudflare:workers` does not exist
 * during the prerender pass.
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

export function getEnv(): Env {
  // import.meta.env carries build-time and .env values; the Worker env wins
  // because that is where deployed secrets live.
  // `wrangler types` generates Cloudflare.Env with every key as a required
  // string. At runtime a secret can genuinely be absent — an unset variable in a
  // fresh environment — so the local Env type keeps them optional and the cast
  // goes through `unknown`.
  return {
    ...(import.meta.env as unknown as Env),
    ...((workerEnv ?? {}) as unknown as Env),
  };
}

/** Read a required secret, throwing an error that names the missing key. */
export function requireEnv(env: Env, key: keyof Env & string): string {
  const value = env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. See .dev.vars.example and README.md.`
    );
  }
  return value;
}
