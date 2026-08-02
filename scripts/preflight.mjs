/**
 * Deploy preflight.
 *
 * Two things about this stack are easy to get wrong and silent when you do:
 *
 *  1. `PUBLIC_*` variables are inlined at BUILD time, not read at runtime. The
 *     Cloudflare Vite plugin feeds `.dev.vars` into the build, so whatever is in
 *     that file when you run `npm run deploy` is what ships to users.
 *  2. Cloudflare's Turnstile test keys (`1x…` / `2x…`) always pass or always
 *     fail. Shipping `1x00000000000000000000AA` means the forms have no bot
 *     protection at all, and nothing visibly breaks.
 *
 * This prints what is about to be baked in and flags test credentials. It warns
 * rather than blocks, because a sandbox deploy with test keys is a legitimate
 * thing to want — it just should not be a surprise.
 */
import { readFileSync, existsSync } from 'node:fs';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const OFF = '\x1b[0m';

/**
 * Strip surrounding quotes and any trailing `# comment`.
 *
 * The comment matters: .dev.vars annotates most values (`STRIPE_PRICE_ESSAY_REVIEW=
 * "price_…"  # $300.00 one-time`). A naive endsWith('"') check never fires on those
 * lines, so the closing quote stays attached and every prefix test below silently
 * fails — which read as "these are Product IDs, not Price IDs" against IDs that
 * were perfectly correct.
 */
function unquote(value) {
  const quoted = /^(['"])([\s\S]*?)\1\s*(?:#.*)?$/.exec(value);
  if (quoted) return quoted[2];
  // Unquoted: a comment only starts at whitespace-then-#, so URLs with a
  // fragment (https://…#foo) survive intact.
  return value.split(/\s+#/)[0].trim();
}

function parseEnvFile(path) {
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    out[key] = unquote(trimmed.slice(eq + 1).trim());
  }
  return out;
}

// Later files win, matching how the build resolves them.
const sources = ['.dev.vars', '.env', '.env.production'];
const merged = {};
const seenIn = {};
for (const file of sources) {
  const parsed = parseEnvFile(file);
  if (!parsed) continue;
  for (const [k, v] of Object.entries(parsed)) {
    merged[k] = v;
    seenIn[k] = file;
  }
}
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('PUBLIC_') || k.startsWith('STRIPE_') || k.startsWith('TURNSTILE_')) {
    if (v) {
      merged[k] = v;
      seenIn[k] = 'shell env';
    }
  }
}

const warnings = [];
const notes = [];

console.log(`\n${BOLD}Deploy preflight${OFF}`);
console.log(`${DIM}Values below are what the build will inline or the Worker will read.${OFF}\n`);

/* ---------------------------------------------------------------- PUBLIC_* */

console.log(`${BOLD}Baked into the client bundle at build time${OFF}`);

const siteKey = merged['PUBLIC_TURNSTILE_SITE_KEY'];
if (!siteKey) {
  console.log(`  PUBLIC_TURNSTILE_SITE_KEY  ${RED}MISSING${OFF}`);
  warnings.push(
    'PUBLIC_TURNSTILE_SITE_KEY is unset. The widget will not render, no token is produced, and EVERY form submission will be rejected server-side with verification_failed.'
  );
} else if (siteKey.startsWith('1x') || siteKey.startsWith('2x') || siteKey.startsWith('3x')) {
  console.log(`  PUBLIC_TURNSTILE_SITE_KEY  ${YELLOW}${siteKey}${OFF}  ${DIM}(from ${seenIn['PUBLIC_TURNSTILE_SITE_KEY']})${OFF}`);
  warnings.push(
    `Turnstile TEST site key detected (${siteKey}). Fine for sandbox. On a public production deploy this means the forms have NO bot protection.`
  );
} else {
  console.log(`  PUBLIC_TURNSTILE_SITE_KEY  ${GREEN}${siteKey.slice(0, 12)}…${OFF}  ${DIM}(from ${seenIn['PUBLIC_TURNSTILE_SITE_KEY']})${OFF}`);
}

const calLink = merged['PUBLIC_CAL_LINK'];
if (!calLink) {
  console.log(`  PUBLIC_CAL_LINK            ${YELLOW}MISSING${OFF}`);
  notes.push(
    'PUBLIC_CAL_LINK is unset. /book will permanently show the "scheduler didn\'t load" fallback with the phone number. Degrades gracefully, but no one can self-book.'
  );
} else {
  console.log(`  PUBLIC_CAL_LINK            ${GREEN}${calLink}${OFF}  ${DIM}(from ${seenIn['PUBLIC_CAL_LINK']})${OFF}`);
  notes.push(`Confirm https://cal.com/${calLink} actually resolves — a 404 makes cal.com's embed script throw.`);
}

/* ------------------------------------------------------------- server-side */

console.log(`\n${BOLD}Server-side (Worker secrets)${OFF}`);

const secret = merged['STRIPE_SECRET_KEY'] ?? '';
if (!secret || secret.includes('replace_me')) {
  console.log(`  STRIPE_SECRET_KEY          ${RED}${secret ? 'PLACEHOLDER' : 'MISSING'}${OFF}`);
  warnings.push('STRIPE_SECRET_KEY is unset or still a placeholder — checkout will fail.');
} else {
  const live = secret.startsWith('sk_live_');
  console.log(`  STRIPE_SECRET_KEY          ${live ? RED + 'LIVE MODE' : GREEN + 'test mode'}${OFF}`);
  if (live) warnings.push('Stripe is in LIVE mode. Real cards will be charged.');
}

const priceVars = [
  'STRIPE_PRICE_COUNSELING_BUNDLE',
  'STRIPE_PRICE_ESSAY_REVIEW',
  'STRIPE_PRICE_ESSAY_REVIEWS_5',
  'STRIPE_PRICE_ZOOM_FOLLOWUPS_5',
  'STRIPE_PRICE_RUSH_CONSULTATION',
];
const unsetPrices = priceVars.filter((k) => !merged[k] || merged[k].includes('replace_me'));
const wrongPrefix = priceVars.filter((k) => merged[k] && !merged[k].includes('replace_me') && !merged[k].startsWith('price_'));
console.log(`  STRIPE_PRICE_* (5)         ${unsetPrices.length === 0 ? GREEN + 'all set' : YELLOW + `${5 - unsetPrices.length}/5 set`}${OFF}`);
if (unsetPrices.length) warnings.push(`Unset or placeholder Price IDs: ${unsetPrices.join(', ')}. Those products cannot be purchased.`);
if (wrongPrefix.length) warnings.push(`These look like Product IDs, not Price IDs (must start with "price_"): ${wrongPrefix.join(', ')}.`);

for (const [key, label, consequence] of [
  ['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET     ', 'Webhook signature checks will fail — no welcome email, no internal notification.'],
  ['TURNSTILE_SECRET', 'TURNSTILE_SECRET          ', 'siteverify fails closed — every form submission is rejected.'],
  // (test-key detection for the secret half happens just below)
  ['RESEND_API_KEY', 'RESEND_API_KEY            ', 'No email is delivered at all (forms return 502; purchase emails silently skipped).'],
]) {
  const v = merged[key];
  const ok = v && !v.includes('replace_me');
  console.log(`  ${label} ${ok ? GREEN + 'set' : RED + 'MISSING'}${OFF}`);
  if (!ok) warnings.push(`${key} is unset. ${consequence}`);
}

const tsSecret = merged['TURNSTILE_SECRET'] ?? '';
if (tsSecret.startsWith('1x') || tsSecret.startsWith('2x') || tsSecret.startsWith('3x')) {
  warnings.push(
    `Turnstile TEST secret key detected (${tsSecret.slice(0, 4)}…). ${tsSecret.startsWith('2x') ? 'This one ALWAYS FAILS — every submission will be rejected.' : 'This one always passes.'}`
  );
}

const portal = merged['STRIPE_PORTAL_URL'];
console.log(`  STRIPE_PORTAL_URL          ${portal && !portal.includes('replace_me') ? GREEN + 'set' : YELLOW + 'unset'}${OFF}`);
if (!portal || portal.includes('replace_me')) {
  warnings.push(
    'STRIPE_PORTAL_URL is unset. The bundle welcome email degrades to "email us to cancel" — the exact friction California\'s Automatic Renewal Law targets. See CONTENT-REVIEW.md §1.1.'
  );
}

const from = merged['FROM_EMAIL'] ?? '';
if (from && !from.includes('resend.dev') && !from.includes('universitynavigator.org')) {
  notes.push(`FROM_EMAIL is ${from} — make sure that domain is verified in Resend or delivery will fail SPF/DKIM.`);
}
if (!from || from.includes('universitynavigator.org')) {
  notes.push(
    'Resend only delivers to arbitrary recipients once the sending domain is verified. Until then, use FROM_EMAIL="onboarding@resend.dev" and expect delivery ONLY to your own Resend signup address.'
  );
}

/* -------------------------------------------------------------------- exit */

if (notes.length) {
  console.log(`\n${BOLD}Notes${OFF}`);
  for (const n of notes) console.log(`  ${DIM}·${OFF} ${n}`);
}

if (warnings.length) {
  console.log(`\n${YELLOW}${BOLD}Warnings (${warnings.length})${OFF}`);
  for (const w of warnings) console.log(`  ${YELLOW}!${OFF} ${w}`);
} else {
  console.log(`\n${GREEN}No warnings.${OFF}`);
}

/*
 * Advisory only — deliberately does NOT block the build.
 *
 * It used to hard-fail on a missing PUBLIC_TURNSTILE_SITE_KEY. That stopped
 * silently-broken forms shipping, but it also blocked every unrelated fix from
 * deploying, which was worse: a push-to-deploy pipeline just stopped deploying.
 *
 * The forms now handle the missing key themselves — they disable and show the
 * phone number instead of accepting submissions that would 403. So a missing key
 * degrades one feature visibly rather than breaking the whole deploy.
 */
console.log(
  `\n${DIM}Warnings above are advisory. Run alone with: npm run preflight${OFF}\n`
);
