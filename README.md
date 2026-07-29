# University Navigator, Inc.

Production website for an independent college admissions consulting firm in
Southern California. Astro + React islands, deployed to Cloudflare Workers with
static assets. Payments through Stripe Checkout, free-consultation scheduling
through cal.com, transactional email through Resend.

**Read [`CONTENT-REVIEW.md`](./CONTENT-REVIEW.md) before launching.** It lists every
passage still awaiting the owner's or counsel's sign-off, plus three compliance
questions — the most important being California's Automatic Renewal Law.

---

## Contents

- [Quick start](#quick-start)
- [How the site is put together](#how-the-site-is-put-together)
- [Secrets](#secrets)
- [Editing content without touching code](#editing-content-without-touching-code)
- [Stripe](#stripe)
- [cal.com](#calcom)
- [Turnstile and email](#turnstile-and-email)
- [Deploying](#deploying)
- [Pointing universitynavigator.org at the Worker](#pointing-universitynavigatororg-at-the-worker)
- [Known gotchas](#known-gotchas)

---

## Quick start

```bash
npm install
cp .dev.vars.example .dev.vars     # then fill it in — see § Secrets
npm run dev                        # http://localhost:4321
```

| Script | Does |
|---|---|
| `npm run dev` | Astro dev server; reads `.dev.vars` |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the built output on the real Workers runtime via `wrangler dev` |
| `npm run check` | `astro check` — TypeScript across `.astro`, `.ts`, `.tsx` |
| `npm run deploy` | Build, then `wrangler deploy` |
| `npm run cf-typegen` | Regenerate Worker binding types from `wrangler.jsonc` |

`npm run preview` is worth using before any deploy: `npm run dev` runs Vite, while
`wrangler dev` runs the actual `workerd` runtime, which is where Node-compatibility
problems surface.

---

## How the site is put together

**Astro 7** with **`@astrojs/cloudflare`**, `output: 'server'` plus per-route
prerendering. Every marketing and policy page sets `export const prerender = true`
and ships as a static file. Only five API endpoints, `/checkout/[product]` and
`/thank-you` execute on the Worker.

> **On the Astro version.** The original brief specified Astro 5.
> `@astrojs/cloudflare@14` declares `peerDependencies: { astro: "^7.0.0" }`, so
> Astro 5 would have pinned the adapter to its 13.x maintenance line. Built on
> Astro 7. See `CONTENT-REVIEW.md` §4.2.

**React islands only where interaction is real** — the compass needle, mobile nav,
cal.com embed, the three forms, and the refund-acknowledgement gate. Everything
else is static HTML with zero client JS.

```
src/
  assets/          images processed by astro:assets (hashed, resized, lazy)
  components/      .astro for static, .tsx for the islands
  content/
    services/      5 MDX files — one per product
    policies/      4 MDX files — refunds, scope, privacy, terms
  layouts/Base.astro
  lib/
    products.ts    canonical catalog; prices are DISPLAY ONLY
    site.ts        contact details, nav, bearings, refund policy
    schemas.ts     Zod, shared by islands and API routes
    stripe.ts      Workers-configured Stripe client
    email.ts       Resend templates
    turnstile.ts   server-side siteverify
    env.ts         runtime secret access
    jsonld.ts      structured data
  pages/
    api/           contact, newsletter, inquiry, checkout, stripe-webhook
public/
  fonts/           6 self-hosted woff2 (2 families x 3 subsets)
```

**Fonts** are self-hosted and never fetched from Google at runtime. Both families
are variable woff2 — one file per subset serves every weight — with the
`unicode-range` values taken from the design source. Only the two `latin` subsets
are preloaded.

**The compass** in the header is a real design element, not decoration. Each route
has a bearing; the needle rotates `bearing + min(40, scrollY / 30)` on a
rAF-throttled passive scroll listener. Bearings live in `src/lib/site.ts`.

---

## Secrets

`.dev.vars.example` is the authoritative list. Copy it to `.dev.vars` for local
work — **`.dev.vars` is git-ignored and must stay that way.**

| Variable | What it is |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` locally, `sk_live_…` in production |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`. **The CLI and the dashboard endpoint have different secrets** |
| `STRIPE_PRICE_COUNSELING_BUNDLE` | Price ID, $2,750.00 recurring every 3 months |
| `STRIPE_PRICE_ESSAY_REVIEW` | Price ID, $300.00 one-time |
| `STRIPE_PRICE_ESSAY_REVIEWS_5` | Price ID, $775.00 one-time |
| `STRIPE_PRICE_ZOOM_FOLLOWUPS_5` | Price ID, $725.00 one-time |
| `STRIPE_PRICE_RUSH_CONSULTATION` | Price ID, $100.00 one-time |
| `STRIPE_PORTAL_URL` | Customer Portal login link. **Required for ARL compliance** |
| `RESEND_API_KEY` | `re_…` |
| `FROM_EMAIL` | Verified sending identity on the Resend domain |
| `INTERNAL_NOTIFY_EMAIL` | Where purchase + form notifications land. Defaults to `info@universitynavigator.org` |
| `TURNSTILE_SECRET_KEY` | Turnstile server key |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile client key (public by design) |
| `PUBLIC_CAL_LINK` | e.g. `universitynavigator/free-consultation` |
| `RUSH_RESPONSE_HOURS` | Rush response commitment in hours. Defaults to `24` |

`PUBLIC_*` variables are inlined into the client bundle at build time — they are
meant to be visible. Everything else is server-only.

**Uploading production secrets:**

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
# …and each STRIPE_PRICE_*, STRIPE_PORTAL_URL, INTERNAL_NOTIFY_EMAIL, FROM_EMAIL
```

Because `PUBLIC_*` values are baked in at build time, they must be present in the
**build** environment, not just at runtime. When building through Workers Builds,
set `PUBLIC_TURNSTILE_SITE_KEY` and `PUBLIC_CAL_LINK` as build variables too.

Secrets are never written to `wrangler.jsonc`.

---

## Editing content without touching code

Copy lives in **MDX files** under `src/content/`. Editing them requires no
knowledge of the components.

### Services — `src/content/services/*.mdx`

One file per product. The part above the `---` line is structured data:

```yaml
name: 1 Application / Essay Review
lede: Your college essay is one of the most important parts…
includes:
  - n: '01'
    t: Professional editing and polishing
    d: Precise corrections and detailed feedback across structure, tone…
how: Email us your draft and we'll return it with precise corrections…
```

- `lede` — the opening paragraph on the detail page
- `cardSummary` — the shorter text on `/services`
- `includes` — the numbered "What's included" rows (`n` number, `t` title, `d` detail)
- `how` — the "How it works" paragraph; delete the line to hide the section
- Anything typed **below** the `---` block appears on the detail page as extra prose

### Policies — `src/content/policies/*.mdx`

The whole body is the policy text. `##` starts a new section heading, `-` makes a
bullet, `>` makes the highlighted quote block.

For the Scope page, if you add or rename a `##` heading, also update the
`tableOfContents:` list in that file's frontmatter — that is what the sidebar
"On this page" list reads.

### Prices, phone number, email

- **Prices and product names:** `src/lib/products.ts`. Changing a price here
  changes only what is *displayed*. **The amount actually charged comes from
  Stripe** — you must update the Stripe Price too, or the site will advertise one
  figure and charge another.
- **Phone, email, tagline:** `src/lib/site.ts`.
- **Refund policy:** `src/lib/site.ts` (`REFUND_POLICY`). It is defined once and
  reused on the services index, every service page, the policy page, and inside
  the welcome email, so all five stay in step.

### Draft markers

Passages carrying `[DRAFT COPY — REVIEW]` show a small red marker **in development
only**. They are never emitted in a production build. Once approved, delete the
`<DraftFlag />` tag and set `needsReview: false`.

After editing, run `npm run build` — a typo in frontmatter fails the build with a
message naming the file and field.

---

## Stripe

### Flow

The browser **never** sends an amount. `/api/checkout` receives a product *slug*,
looks up the Price ID from an environment variable, creates a Checkout Session and
answers `303` to Stripe's hosted page. No card field is ever rendered on this site.

Payment starts on the product page because that is where the **refund-policy
acknowledgement gate** lives — Continue stays disabled until the box is ticked, and
the acknowledgement plus an ISO timestamp travel into Session `metadata`. That is
chargeback evidence, so it is recorded, not just displayed. Hitting
`/checkout/<product>` directly bounces back to the product page rather than
creating a session with no acknowledgement attached.

### Creating the Prices

Create five Prices in the Stripe Dashboard matching `src/lib/products.ts` exactly:

| Product | Amount | Type |
|---|---|---|
| University Counseling Bundle | $2,750.00 | Recurring, **every 3 months** |
| 1 Application / Essay Review | $300.00 | One-time |
| 5 Additional Essay Reviews | $775.00 | One-time |
| Five Additional Zoom Follow-Ups | $725.00 | One-time |
| Rush consultation fee | $100.00 | One-time |

Copy each `price_…` ID (not the `prod_…` ID) into the matching env var.

### Payment methods

ACH Direct Debit is enabled and shown first on the **bundle only**: ACH is 0.8%
capped at $5 against a card's 2.9% + $0.30 — about $5 versus $80 on a $2,750
renewal.

ACH is deliberately **not** offered on the essay products or rush. It settles in
days, and the site advertises a 72-hour turnaround starting *"at submission and
payment"* — accepting ACH there would breach a written promise before work began.

### Two emails, on purpose

Both are needed and neither replaces the other:

1. **Stripe's own receipt** — proof of payment, card last-4, and an invoice PDF for
   the subscription. This is what customers file for taxes and what you rely on as
   dispute evidence. **Do not suppress it and do not rebuild it.** Its
   customisation is limited to branding and
   `payment_intent_data.description`; policy copy cannot go in it.
2. **The welcome email** — sent from the `checkout.session.completed` webhook via
   Resend. This is where the refund policy is restated verbatim and itemized,
   alongside what happens next, how to submit essay drafts, and (for the bundle)
   the Customer Portal link.

Every purchase also fires a **second, separate** internal notification to
`INTERNAL_NOTIFY_EMAIL` with product, customer name and email, and the
acknowledgement timestamp. This is the entire technical handoff to the person who
does the scheduling. **Rush purchases are prefixed `[URGENT — 24h]`** because they
carry a response clock the others do not.

### Stripe Dashboard setup — manual, not code

These are dashboard configuration and cannot be set from this repository:

- [ ] **Customer emails → Successful payments: ON**
      (Settings → Business → Customer emails). Also enable **Refunds**.
- [ ] **Branding** (Settings → Business → Branding): square logo >128px and
      <512KB; brand colour `#560F10`, accent `#D8A13A`.
- [ ] **Subscription Management / near one-click cancellation: ON.**
      Required for FTC and **California Automatic Renewal Law** compliance. This
      business is squarely inside it — a CA company auto-renewing a $2,750
      quarterly charge for CA families. Highest compliance risk in the build; see
      `CONTENT-REVIEW.md` §1.1.
- [ ] **Customer Portal: ON**, allowing payment-method updates and cancellation.
      Copy the login link into `STRIPE_PORTAL_URL`. Without it, every cancellation
      becomes a manual email to the office.
- [ ] **Upcoming renewal emails: ON.** A surprise $2,750 charge with no warning
      produces disputes and angry parents.
- [ ] **Failed payment emails + Smart Retries: ON**
      (Settings → Billing → Revenue recovery). A $2,750 card charge gets declined
      for over-limit more often than you would expect.
- [ ] **Stripe Tax: leave OFF** pending the CPA's answer — see
      `CONTENT-REVIEW.md` §1.2.

### Webhook

Endpoint: `POST https://universitynavigator.org/api/stripe-webhook`
Event: `checkout.session.completed`

Two implementation details that are easy to get wrong on Workers, both already
handled:

- Signatures are verified with **`constructEventAsync()`**. The synchronous
  `constructEvent` uses Node's crypto module and throws on Workers.
- The raw body is read as **text before any parsing** — verification runs over the
  exact bytes Stripe signed.

**Testing locally:**

```bash
stripe login
stripe listen --forward-to localhost:4321/api/stripe-webhook
# copy the printed whsec_… into .dev.vars as STRIPE_WEBHOOK_SECRET

# in another terminal:
stripe trigger checkout.session.completed
```

The `whsec_` from `stripe listen` is **different** from the one the dashboard
endpoint shows. Using the wrong one produces a 400 with "Invalid signature".

To exercise the real flow end to end, walk through a product page with card
`4242 4242 4242 4242`, any future expiry, any CVC.

---

## cal.com

**The scheduler handles the free consultation and nothing else.** No paid event
types, no Stripe app on cal.com, no paid bookings. Every paid service is purchased
on this site and scheduled by a person afterward. The free tier is sufficient.

Configure one event type:

- **Free consultation**, 30 minutes, video (Zoom or Cal Video), free
- Connect the Google Workspace calendar **two-way** so Mt. San Antonio College
  teaching hours block automatically
- 24–48h minimum notice, 15-minute after-buffer, and a weekly cap so consultations
  do not consume the schedule
- Reminder workflows at **24h and 1h** — no-shows are the main failure mode for a
  free-consult funnel
- Booking questions: student name, parent/guardian name, current school,
  graduation year, what they'd most like to discuss

Set `PUBLIC_CAL_LINK` to the path after `cal.com/`, e.g.
`universitynavigator/free-consultation`.

The embed is lazy-loaded on first intersection and themed to the palette. **If it
fails to load within 8 seconds — privacy extensions block cal.com fairly often —
a fallback panel replaces it** with a direct link to the booking page and the phone
number. That is deliberate defensive UI; do not remove it. Test it by blocking
`app.cal.com` in devtools.

cal.com stores data about minors and is named as a subprocessor in the privacy
policy.

---

## Turnstile and email

**Turnstile** protects all three forms. Server-side `siteverify` runs on every
submission and **fails closed** — a missing secret or a network error rejects
rather than admits.

Cloudflare's test keys are handy locally:

```
# always passes
PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
# always fails — use to check the error states
TURNSTILE_SECRET_KEY="2x0000000000000000000000000000000AA"
```

**Resend** delivers everything. Verify the sending domain first, or messages will
silently fail SPF/DKIM.

**Privacy.** These forms routinely describe minors — names, birthdates, addresses,
school, first-generation status, U.S. military status. Accordingly:

- Submissions are **emailed and never persisted**, matching the privacy policy
- **No field value is written to any log**, including on failure paths — only field
  *names* are ever returned to the client
- The inquiry draft uses `sessionStorage`, not `localStorage`, so it dies with the
  tab; the privacy policy discloses this
- No third-party analytics or trackers. Cloudflare Web Analytics is cookieless if
  you want it later — add the beacon and update the CSP in `public/_headers`

---

## Sandbox deploy — first run

Getting a working test deployment, in order. Each step is a prerequisite for the
next, so do not skip ahead.

**1. Cloudflare**

```bash
npx wrangler login
npm run deploy          # runs preflight, builds, deploys
```

The first deploy creates the `SESSION` KV namespace and gives you a
`*.workers.dev` URL. The site will render immediately; forms and checkout will not
work until the steps below.

**2. Stripe (test mode)**

Create the five Prices in **test mode** with the exact amounts in the table above,
then set the secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY            # sk_test_…
npx wrangler secret put STRIPE_PRICE_ESSAY_REVIEW    # price_… (and the other four)
```

Add a webhook endpoint in the Stripe dashboard pointing at
`https://<your-worker>.workers.dev/api/stripe-webhook`, subscribed to
`checkout.session.completed`, then:

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET        # the whsec_ from the DASHBOARD endpoint
```

Test card `4242 4242 4242 4242`, any future expiry, any CVC.

**3. Resend — read this before testing purchase emails**

Resend will only deliver to arbitrary recipients **after you verify a sending
domain.** Until then it delivers only to the address you signed up with, and
anything else fails silently.

For sandbox, either verify `universitynavigator.org` in Resend, or:

```bash
npx wrangler secret put FROM_EMAIL          # "University Navigator <onboarding@resend.dev>"
npx wrangler secret put INTERNAL_NOTIFY_EMAIL   # your own Resend signup address
npx wrangler secret put RESEND_API_KEY
```

Separately: **in Stripe test mode, Stripe's own receipts only send to a verified
sandbox email.** Receipts looking broken in test is expected — see § Known gotchas.

**4. Turnstile**

Create a widget in the Cloudflare dashboard with your `workers.dev` hostname (and
later the real domain) in its allowed hostnames.

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

`PUBLIC_TURNSTILE_SITE_KEY` is **build-time** — put it in `.dev.vars` (or `.env`)
and rebuild. A secret alone will not work.

**5. cal.com**

Create the free-consultation event type, then set `PUBLIC_CAL_LINK` in
`.dev.vars`/`.env` and rebuild. Until the link resolves, `/book` shows the
fallback panel — which is correct behaviour, not a bug.

### The one thing that will bite you

`.dev.vars` is fed into the **build**, so `PUBLIC_*` values in it ship to users.
Running `npm run deploy` with the Turnstile *test* key in `.dev.vars`
(`1x00000000000000000000AA`) publishes a site whose bot protection always passes,
and nothing visibly breaks.

`npm run deploy` runs `npm run preflight` first, which prints exactly what is about
to be baked in and flags test credentials. It warns, never blocks — a sandbox
deploy with test keys is legitimate. Run it any time:

```bash
npm run preflight
```

---

## Deploying

```bash
npm run check      # must be clean
npm run preflight  # what is about to be baked in
npm run build
npm run preview    # exercise it on the real workerd runtime
npm run deploy     # preflight + build + wrangler deploy
```

`wrangler.jsonc` sets `nodejs_compat` (the Stripe SDK needs it), an `assets`
binding serving `dist/client`, and `not_found_handling: "404-page"` so unmatched
URLs get the designed 404 rather than a bare Worker error.

`main` points at `@astrojs/cloudflare/entrypoints/server` — **not** a path inside
`dist/`. The Cloudflare Vite plugin resolves `main` before the build has produced
anything, so a `dist/` path fails the build.

**First deploy will provision a KV namespace.** The adapter enables Astro sessions
by default and emits a `SESSION` KV binding with no id, so the first
`wrangler deploy` creates that namespace (and may prompt for confirmation on an
interactive terminal). This site never calls `Astro.session`, so the namespace
stays empty — it is harmless, but if you are deploying from CI, run the first
deploy interactively, or pre-create it and add the id to `wrangler.jsonc`:

```bash
npx wrangler kv namespace create SESSION
```

Verified with `npx wrangler deploy --dry-run`: 29 modules, ~1.08 MiB worker
(507 KiB of that is the Stripe SDK), 387 KiB gzipped, plus 91 static assets — well
inside the Workers size limit.

Security headers, including a strict CSP allowing only what cal.com, Turnstile and
Stripe Checkout need, live in `public/_headers`. Stripe.js is never loaded
client-side, so `js.stripe.com` is deliberately absent from `script-src`. If you
add a third-party script, it must be added there or it will be blocked.

---

## Pointing universitynavigator.org at the Worker

1. Add the domain to Cloudflare and move its nameservers to Cloudflare (the
   registrar's dashboard → set the two `*.ns.cloudflare.com` values Cloudflare
   gives you). Wait for the zone to read **Active**.
2. In the dashboard: **Workers & Pages → university-navigator → Settings → Domains
   & Routes → Add → Custom domain**. Add both `universitynavigator.org` and
   `www.universitynavigator.org`. Cloudflare creates the DNS records and issues
   the certificate — do not add A/CNAME records by hand.
3. Redirect the apex or `www` to whichever is canonical with a **Redirect Rule**
   (Rules → Redirect Rules), 301. `src/lib/site-url.mjs` sets
   `https://universitynavigator.org` as canonical, so redirect `www` → apex.
4. SSL/TLS → Overview → set encryption mode to **Full (strict)**.
5. Update the Stripe webhook endpoint to the live domain and copy the new
   `whsec_…` into the production secret.
6. Check `https://universitynavigator.org/sitemap-index.xml` and `/robots.txt`
   resolve, then submit the sitemap in Google Search Console.

The canonical origin is set in **`src/lib/site-url.mjs`** — it feeds `astro.config.mjs`,
canonical tags, OG URLs, the sitemap and JSON-LD. Change it in that one place.

---

## Measured quality

Lighthouse 12, desktop preset, run against the **production build** served
statically (not the dev server):

| Route | Perf | A11y | Best practices | SEO |
|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 100 |
| `/services` | 100 | 100 | 100 | 100 |
| `/services/essay-review` | 100 | 100 | 100 | 100 |
| `/about` | 99 | 100 | 100 | 100 |
| `/contact` | 99 | 100 | 100 | 100 |
| `/inquiry` | 99 | 100 | 100 | 100 |
| `/policies/scope` | 100 | 100 | 100 | 100 |
| `/book` | 99 | 100 | **74** | 100 |
| `/404` | 100 | 100 | 100 | **69** |

Two scores are below 95 and both are explained, not outstanding work:

- **`/book` best practices — 74.** Every deduction comes from cal.com's own
  `embed.js`: its third-party cookies (`__cf_bm`, `__Secure-next-auth.*`) and a
  console error. The console error is *"iframe doesn't exist"*, thrown because the
  placeholder `PUBLIC_CAL_LINK` in this repo points at an event type that does not
  exist yet — `cal.com/universitynavigator/free-consultation` currently returns
  404. **Re-measure once the real event type is configured; that error should
  disappear.** The third-party-cookie deduction will remain for as long as cal.com
  is embedded, and is not fixable from this codebase.
- **`/404` SEO — 69.** The single failing audit is `is-crawlable`, because the page
  sets `noindex`. That is correct for a 404 and should not be "fixed".

To reproduce:

```bash
npm run build
npx http-server dist/client -p 8788 -s
CHROME_PATH=$(which google-chrome) npx lighthouse@12 http://localhost:8788/ \
  --preset=desktop --only-categories=performance,accessibility,best-practices,seo --view
```

Structural accessibility was additionally checked across all routes: exactly one
`<h1>` per page, no heading-level jumps, every image with `alt`, every form control
labelled, `main`/`header`/`footer` landmarks, `lang` set, and a working skip link.
No horizontal overflow at 320 / 375 / 414px.

**Contrast.** Three colour pairings inherited from the design source failed WCAG AA
and were darkened — see `CONTENT-REVIEW.md` §4.1 for the measurements. In
particular, **gold `#D8A13A` measures 2.16:1 on the page background and must never
be used for text on a light surface.** Use `--color-gold-dark` (`#8A6420`, 5.00:1)
there and keep gold for text on maroon (6.17:1).

---

## Known gotchas

**Stripe receipts look broken in test mode.** In test mode / sandbox, Stripe only
auto-sends receipts when the customer email is a verified email with sandbox
permissions on the account. Receipts will appear not to work locally and will work
in production. Do not spend an afternoon on this.

**Two different webhook secrets.** `stripe listen` prints one; the dashboard
endpoint has another. Mixing them up gives "Invalid signature".

**`constructEvent` vs `constructEventAsync`.** The synchronous version uses Node
crypto and fails on Workers. Already handled — do not "simplify" it back.

**`Astro.locals.runtime.env` no longer exists.** Removed in Astro 6. Runtime
secrets come from `import { env } from 'cloudflare:workers'`, wrapped by
`src/lib/env.ts`. Only import that module from server-side code — the virtual
module does not exist during the prerender pass.

**Webhook idempotency is in-memory.** Replays are de-duplicated with an in-isolate
`Set` of event IDs, which covers Stripe retrying while the isolate is warm. A retry
landing on a cold isolate would re-send the welcome email. If that is ever
observed, add a KV binding keyed on `event.id`.

**`PUBLIC_*` variables are build-time — and this one bit us in production.**
`PUBLIC_CAL_LINK` and `PUBLIC_TURNSTILE_SITE_KEY` are inlined into the HTML at
build time, so they must exist *wherever the build runs*. `.dev.vars` is
git-ignored, so Cloudflare Workers Builds never saw them, and the first deploy
went out with both empty. Nothing errored: the cal.com embed quietly rendered its
fallback panel and **every form submission 403'd** with `verification_failed`.

Both now live in a **committed `.env`** (they are public values — a Turnstile
*site* key is meant to be in the page source; only the *secret* key is not).
`npm run build` runs `scripts/preflight.mjs` first and **exits non-zero** if
`PUBLIC_TURNSTILE_SITE_KEY` is missing, so silently-broken forms cannot ship
again. Deliberate forms-off deploy: `ALLOW_MISSING_TURNSTILE=1 npm run build`.

Changing either value still requires a rebuild, not just a secret update.

**Turnstile has a 300px minimum width.** It is scaled down under 380px via
`.turnstile-wrap` in `global.css`; without that the form pages scroll sideways on a
320px screen.
