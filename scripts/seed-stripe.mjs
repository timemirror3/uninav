/**
 * Seed a Stripe SANDBOX (or test mode) with the five Prices this site sells.
 *
 * The amounts here are the single source of truth check against
 * src/lib/products.ts — the site displays those figures and charges whatever
 * the Price object says, so a mismatch is a consumer-protection problem.
 *
 * Idempotent: each Price carries a `lookup_key` equal to the product slug. Re-run
 * it and existing Prices are reused rather than duplicated. Stripe Prices are
 * immutable, so if an amount here ever changes you must archive the old Price and
 * pick a new lookup_key — the script tells you instead of silently diverging.
 *
 * Refuses to run against a live key. Seeding is a test-data operation.
 *
 *   node scripts/seed-stripe.mjs            # create/reuse, then write .dev.vars
 *   node scripts/seed-stripe.mjs --dry-run  # show what it would do
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import Stripe from 'stripe';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const OFF = '\x1b[0m';

const DRY_RUN = process.argv.includes('--dry-run');

/** Mirrors src/lib/products.ts. Amounts in minor units. */
const CATALOG = [
  {
    slug: 'counseling-bundle',
    envKey: 'STRIPE_PRICE_COUNSELING_BUNDLE',
    name: 'University Counseling Bundle',
    description: 'All-in-one quarterly counseling subscription.',
    amount: 275000,
    recurring: { interval: 'month', interval_count: 3 },
  },
  {
    slug: 'essay-review',
    envKey: 'STRIPE_PRICE_ESSAY_REVIEW',
    name: '1 Application / Essay Review',
    description: 'One full essay review, 72-hour turnaround.',
    amount: 30000,
  },
  {
    slug: 'essay-reviews-5',
    envKey: 'STRIPE_PRICE_ESSAY_REVIEWS_5',
    name: '5 Additional Application / Essay Reviews',
    description: 'Five additional full essay reviews.',
    amount: 77500,
  },
  {
    slug: 'zoom-followups-5',
    envKey: 'STRIPE_PRICE_ZOOM_FOLLOWUPS_5',
    name: 'Five Additional Zoom Follow-Ups',
    description: 'Five additional Zoom sessions.',
    amount: 72500,
  },
  {
    slug: 'rush-consultation',
    envKey: 'STRIPE_PRICE_RUSH_CONSULTATION',
    name: 'Rush consultation fee',
    description: 'Rush consultation — scheduled outside current availability.',
    amount: 10000,
  },
];

/* ------------------------------------------------------------ read the key */

function readDevVars(path = '.dev.vars') {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    // Values in .dev.vars carry trailing `# $300.00 one-time` comments, so the
    // closing quote is not the last character. Same parser as preflight.mjs.
    const raw = trimmed.slice(eq + 1).trim();
    const quoted = /^(['"])([\s\S]*?)\1\s*(?:#.*)?$/.exec(raw);
    out[trimmed.slice(0, eq).trim()] = quoted ? quoted[2] : raw.split(/\s+#/)[0].trim();
  }
  return out;
}

const devVars = readDevVars();
const key = process.env.STRIPE_SECRET_KEY || devVars['STRIPE_SECRET_KEY'] || '';

if (!key || key.includes('replace_me')) {
  console.error(
    `${RED}No usable STRIPE_SECRET_KEY.${OFF}\n` +
      `Put a sandbox key in .dev.vars, or pass it for one run:\n` +
      `  ${DIM}STRIPE_SECRET_KEY=sk_test_… node scripts/seed-stripe.mjs${OFF}`
  );
  process.exit(1);
}

if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
  console.error(
    `${RED}${BOLD}Refusing to run: that is a LIVE key.${OFF}\n` +
      `This script creates test data. Create the real Prices in the Dashboard by hand.`
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2026-06-24.dahlia' });

/* ------------------------------------------------------------------- seed */

console.log(`\n${BOLD}Seeding Stripe sandbox${OFF}${DRY_RUN ? `  ${YELLOW}(dry run)${OFF}` : ''}\n`);

const resolved = {};
let created = 0;
let reused = 0;
let mismatched = 0;

for (const item of CATALOG) {
  const label = item.envKey.padEnd(31);

  // lookup_key is unique per account, so this is the idempotency check.
  const existing = await stripe.prices.list({
    lookup_keys: [item.slug],
    active: true,
    limit: 1,
  });

  if (existing.data.length > 0) {
    const price = existing.data[0];
    const amountOk = price.unit_amount === item.amount;
    const recurringOk = item.recurring
      ? price.recurring?.interval === item.recurring.interval &&
        price.recurring?.interval_count === item.recurring.interval_count
      : price.recurring == null;

    resolved[item.envKey] = price.id;

    if (amountOk && recurringOk) {
      reused++;
      console.log(`  ${label} ${GREEN}reuse${OFF}  ${price.id}`);
    } else {
      mismatched++;
      console.log(`  ${label} ${RED}MISMATCH${OFF}  ${price.id}`);
      console.log(
        `    ${DIM}stripe has ${price.unit_amount} ${price.recurring ? `every ${price.recurring.interval_count} ${price.recurring.interval}` : 'one-time'}; ` +
          `catalog wants ${item.amount} ${item.recurring ? `every ${item.recurring.interval_count} ${item.recurring.interval}` : 'one-time'}${OFF}`
      );
    }
    continue;
  }

  if (DRY_RUN) {
    created++;
    console.log(`  ${label} ${YELLOW}would create${OFF}  ${item.amount} ${item.recurring ? 'recurring' : 'one-time'}`);
    resolved[item.envKey] = 'price_(dry-run)';
    continue;
  }

  const product = await stripe.products.create({
    name: item.name,
    description: item.description,
    metadata: { slug: item.slug, seeded_by: 'scripts/seed-stripe.mjs' },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: item.amount,
    lookup_key: item.slug,
    ...(item.recurring ? { recurring: item.recurring } : {}),
    metadata: { slug: item.slug },
  });

  resolved[item.envKey] = price.id;
  created++;
  console.log(`  ${label} ${GREEN}created${OFF}  ${price.id}`);
}

/* -------------------------------------------------------- write .dev.vars */

if (!DRY_RUN && existsSync('.dev.vars')) {
  const lines = readFileSync('.dev.vars', 'utf8').split('\n');
  const written = new Set();

  const updated = lines.map((line) => {
    const match = /^(\s*)(STRIPE_PRICE_[A-Z0-9_]+)\s*=/.exec(line);
    if (!match || !resolved[match[2]]) return line;
    written.add(match[2]);
    // Keep any trailing "# $300.00 one-time" comment.
    const comment = line.slice(line.indexOf('=') + 1).match(/(\s+#.*)$/)?.[1] ?? '';
    return `${match[1]}${match[2]}="${resolved[match[2]]}"${comment}`;
  });

  // Any catalog key the file never had (the two the file was missing).
  const missing = CATALOG.filter((i) => !written.has(i.envKey));
  if (missing.length) {
    updated.push('', '# Added by scripts/seed-stripe.mjs');
    for (const i of missing) updated.push(`${i.envKey}="${resolved[i.envKey]}"`);
  }

  writeFileSync('.dev.vars', updated.join('\n'));
  console.log(`\n${GREEN}Wrote ${Object.keys(resolved).length} Price IDs into .dev.vars${OFF}${missing.length ? ` ${DIM}(${missing.length} key(s) appended)${OFF}` : ''}`);
}

/* ----------------------------------------------------------------- report */

console.log(
  `\n${BOLD}${created} created, ${reused} reused${mismatched ? `, ${RED}${mismatched} mismatched${OFF}${BOLD}` : ''}.${OFF}`
);

if (mismatched) {
  console.log(
    `\n${YELLOW}Stripe Prices are immutable.${OFF} A mismatch means the catalog changed after seeding.\n` +
      `Archive the old Price in the Dashboard (which frees its lookup_key), then re-run.`
  );
}

if (DRY_RUN) {
  console.log(`\n${DIM}Dry run — nothing was created and .dev.vars was not touched.${OFF}`);
} else {
  console.log(
    `\n${DIM}Next: start the webhook forwarder, then the dev server.${OFF}\n` +
      `  stripe listen --forward-to localhost:4321/api/stripe-webhook\n` +
      `  ${DIM}copy the printed whsec_… into .dev.vars as STRIPE_WEBHOOK_SECRET${OFF}\n` +
      `  npm run dev\n`
  );
}
