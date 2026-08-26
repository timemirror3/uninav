/**
 * Set up the LIVE Stripe account and push the resulting secrets to the Worker.
 *
 * The counterpart to seed-stripe.mjs, which deliberately refuses live keys.
 * This one refuses TEST keys and does nothing until you pass --apply, so the
 * default run is a plan you can read before any live object is created.
 *
 *   node scripts/setup-stripe-live.mjs            # dry run — shows the plan
 *   node scripts/setup-stripe-live.mjs --apply    # create + write .dev.vars + upload
 *
 * What --apply does, in order:
 *   1. For each product in src/lib/products.ts: reuse the active live Price whose
 *      lookup_key is the slug, or create the Product + Price. Amounts must match
 *      the catalog exactly — a mismatch aborts rather than silently diverging.
 *   2. Reuse or create the live webhook endpoint at
 *      https://universitynavigator.org/api/stripe-webhook (checkout.session.completed).
 *      Stripe only reveals the signing secret at creation time; if the endpoint
 *      already exists the .dev.vars value is kept as-is.
 *   3. Write the Price IDs (and new webhook secret) into .dev.vars.
 *   4. `wrangler secret bulk` the eight STRIPE_* values to the production Worker.
 *
 * Never prints a secret value.
 */
import { readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { execSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const WEBHOOK_URL = 'https://universitynavigator.org/api/stripe-webhook';
const BOLD = '\x1b[1m', DIM = '\x1b[2m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m', OFF = '\x1b[0m';

/** Mirrors src/lib/products.ts and scripts/seed-stripe.mjs. Amounts in cents. */
const CATALOG = [
  { slug: 'counseling-bundle', envKey: 'STRIPE_PRICE_COUNSELING_BUNDLE', name: 'University Counseling Bundle', description: 'All-in-one quarterly counseling subscription.', amount: 275000, recurring: { interval: 'month', interval_count: 3 } },
  { slug: 'essay-review', envKey: 'STRIPE_PRICE_ESSAY_REVIEW', name: '1 Application / Essay Review', description: 'One full essay review, 72-hour turnaround.', amount: 30000 },
  { slug: 'essay-reviews-5', envKey: 'STRIPE_PRICE_ESSAY_REVIEWS_5', name: '5 Additional Application / Essay Reviews', description: 'Five additional full essay reviews.', amount: 77500 },
  { slug: 'zoom-followups-5', envKey: 'STRIPE_PRICE_ZOOM_FOLLOWUPS_5', name: 'Five Additional Zoom Follow-Ups', description: 'Five additional Zoom sessions.', amount: 72500 },
  { slug: 'rush-consultation', envKey: 'STRIPE_PRICE_RUSH_CONSULTATION', name: 'Rush consultation fee', description: 'Rush consultation — scheduled outside current availability.', amount: 10000 },
  // Live-payment smoke test offered in the site footer. Refund after testing.
  { slug: 'hotdog', envKey: 'STRIPE_PRICE_HOTDOG', name: 'Hot dog (live payment test)', description: 'A $1.00 live payment test. No hot dog is shipped; refund on request.', amount: 100 },
];

function readDevVars(path = '.dev.vars') {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const raw = t.slice(eq + 1).trim();
    const q = /^(['"])([\s\S]*?)\1\s*(?:#.*)?$/.exec(raw);
    out[t.slice(0, eq).trim()] = q ? q[2] : raw.split(/\s+#/)[0].trim();
  }
  return out;
}

const env = readDevVars();
const key = env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_live_')) {
  console.error(`${RED}${BOLD}Refusing to run: STRIPE_SECRET_KEY in .dev.vars is not a live key.${OFF}\nFor sandbox setup use scripts/seed-stripe.mjs.`);
  process.exit(1);
}

const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' };
async function stripe(method, path, params) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: params ? new URLSearchParams(params) : undefined });
  const j = await r.json();
  if (j.error) throw new Error(`${method} ${path}: ${j.error.message}`);
  return j;
}
const fmt = (i) => `$${(i.amount / 100).toFixed(2)} ${i.recurring ? 'every 3 months' : 'one-time'}`;

const acct = await stripe('GET', '/account');
console.log(`\n${BOLD}Live Stripe setup${OFF}${APPLY ? '' : `  ${YELLOW}(dry run — pass --apply to execute)${OFF}`}`);
console.log(`${DIM}account ${acct.id} · ${acct.settings?.dashboard?.display_name ?? acct.business_profile?.name ?? ''} · charges_enabled=${acct.charges_enabled}${OFF}\n`);

/* --------------------------------------------------------------- prices */
const resolved = {};
console.log(`${BOLD}Prices${OFF}`);
for (const item of CATALOG) {
  const label = item.envKey.padEnd(31);
  const found = (await stripe('GET', `/prices?lookup_keys[]=${item.slug}&active=true&limit=1`)).data[0];
  if (found) {
    const ok = found.unit_amount === item.amount && (item.recurring
      ? found.recurring?.interval === 'month' && found.recurring?.interval_count === 3
      : !found.recurring);
    if (!ok) {
      console.error(`  ${label} ${RED}MISMATCH${OFF} ${found.id} — Stripe has ${found.unit_amount} ${found.recurring ? 'recurring' : 'one-time'}, catalog wants ${item.amount}. Archive it in the Dashboard and re-run.`);
      process.exit(1);
    }
    resolved[item.envKey] = found.id;
    console.log(`  ${label} ${GREEN}reuse${OFF}   ${found.id}  ${DIM}${fmt(item)}${OFF}`);
    continue;
  }
  if (!APPLY) { console.log(`  ${label} ${YELLOW}create${OFF}  ${DIM}"${item.name}" ${fmt(item)}${OFF}`); continue; }
  const product = await stripe('POST', '/products', { name: item.name, description: item.description, 'metadata[slug]': item.slug });
  const p = { product: product.id, currency: 'usd', unit_amount: String(item.amount), lookup_key: item.slug, 'metadata[slug]': item.slug };
  if (item.recurring) { p['recurring[interval]'] = 'month'; p['recurring[interval_count]'] = '3'; }
  const price = await stripe('POST', '/prices', p);
  resolved[item.envKey] = price.id;
  console.log(`  ${label} ${GREEN}created${OFF} ${price.id}  ${DIM}${fmt(item)}${OFF}`);
}

/* -------------------------------------------------------------- webhook */
console.log(`\n${BOLD}Webhook${OFF}`);
const existing = (await stripe('GET', '/webhook_endpoints?limit=100')).data.find((e) => e.url === WEBHOOK_URL);
if (existing) {
  console.log(`  ${GREEN}exists${OFF}  ${existing.id} [${existing.status}] ${existing.enabled_events.join(',')}`);
  console.log(`  ${DIM}Stripe does not re-reveal signing secrets. Keeping STRIPE_WEBHOOK_SECRET from .dev.vars; if that is the old CLI whsec_, copy the real one from Dashboard → Developers → Webhooks → this endpoint.${OFF}`);
} else if (!APPLY) {
  console.log(`  ${YELLOW}create${OFF}  ${WEBHOOK_URL}  ${DIM}checkout.session.completed${OFF}`);
} else {
  const ep = await stripe('POST', '/webhook_endpoints', { url: WEBHOOK_URL, 'enabled_events[]': 'checkout.session.completed', description: 'University Navigator site — Checkout fulfilment' });
  resolved.STRIPE_WEBHOOK_SECRET = ep.secret;
  console.log(`  ${GREEN}created${OFF} ${ep.id} [${ep.status}]  ${DIM}signing secret captured (whsec_…${ep.secret.slice(-4)})${OFF}`);
}

if (!APPLY) {
  console.log(`\n${DIM}Dry run. Nothing was created; .dev.vars and the Worker were not touched.${OFF}\n`);
  process.exit(0);
}

/* ------------------------------------------------------------ .dev.vars */
const lines = readFileSync('.dev.vars', 'utf8').split('\n');
const written = new Set();
const updated = lines.map((line) => {
  const m = /^(\s*)(STRIPE_(?:PRICE_[A-Z0-9_]+|WEBHOOK_SECRET))\s*=/.exec(line);
  if (!m || !resolved[m[2]]) return line;
  written.add(m[2]);
  const comment = line.slice(line.indexOf('=') + 1).match(/(\s+#.*)$/)?.[1] ?? '';
  return `${m[1]}${m[2]}="${resolved[m[2]]}"${comment}`;
});
for (const k of Object.keys(resolved)) if (!written.has(k)) updated.push(`${k}="${resolved[k]}"`);
writeFileSync('.dev.vars', updated.join('\n'));
console.log(`\n${GREEN}Wrote ${Object.keys(resolved).length} value(s) into .dev.vars${OFF}`);

/* --------------------------------------------------------------- upload */
const fresh = readDevVars();
const upload = { STRIPE_SECRET_KEY: fresh.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: fresh.STRIPE_WEBHOOK_SECRET };
for (const i of CATALOG) upload[i.envKey] = fresh[i.envKey];
for (const [k, v] of Object.entries(upload)) {
  if (!v || /replace_me/.test(v)) { console.error(`${RED}Refusing to upload ${k}: empty or placeholder.${OFF}`); process.exit(1); }
}
const tmp = '.secrets-upload.tmp.json';
writeFileSync(tmp, JSON.stringify(upload));
chmodSync(tmp, 0o600);
console.log(`\n${BOLD}Uploading ${Object.keys(upload).length} secrets to the Worker${OFF}`);
try {
  execSync(`npx wrangler secret bulk ${tmp}`, { stdio: 'inherit' });
} finally {
  unlinkSync(tmp);
}
console.log(`\n${GREEN}${BOLD}Done.${OFF} Remaining by hand: STRIPE_PORTAL_URL, RESEND_API_KEY, and the Cloudflare WAF skip rule for ${WEBHOOK_URL}. See LAUNCH-CHECKLIST.md §3.\n`);
