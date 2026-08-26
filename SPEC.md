# SPEC — University Navigator, Inc. website

Derived by reading `prototype/UNI_Website__standalone_.html` end to end: the markup
in `<script type="__bundler/template">`, the component logic in the trailing
`data-dc-script` block, the `@font-face` set in `<helmet>`, and the asset manifest.

This document is the build contract. Where the build intentionally departs from the
prototype, it is marked **[DEPARTURE]** with the reason.

---

## 1. Prototype architecture (what was read)

| Prototype construct | Meaning | Replaced by |
|---|---|---|
| `state.route` string + `<sc-if value="{{ isHome }}">` | Single-component page switch | Real Astro file routes |
| `data-jump="route:variant"` + `jump()` handler | Navigation + state seeding | `<a href>` / server redirects |
| `{{ binding }}` / `<sc-for>` | DCLogic template interpolation | Astro components + content collections |
| `style-hover` / `style-focus` attributes | Prototype-only pseudo-class shim | Tailwind `hover:` / `focus-visible:` |
| Inline `style="…"` everywhere | Mockup convenience | Tailwind 4 tokens |
| `props.simulateSubmitError`, `props.calEmbedUnavailable` | Prototype simulation toggles | **Dropped** (scaffolding) |
| `◈ PROTOTYPE MAP` panel, `SIMULATE: EMBED FAILS` button | Prototype navigation aid | **Dropped** (scaffolding) |

The prototype's assets were embedded as base64 in the bundler manifest, not shipped
as a `source-assets/` folder. They were extracted to `source-assets/` during setup:

| Extracted file | Source UUID | Dimensions | Size |
|---|---|---|---|
| `crest-logo.png` | `c3cc6521…` | 1024×1024 | 1.60 MB |
| `founder-sam-atherton.png` | `2f4ae8ef…` | 1000×750 | 1.15 MB |
| `campus-berkeley-campanile.webp` | `4b16ca29…` | 660×367 | 22 KB |
| `campus-usc-doheny.webp` | `b820905f…` | 660×495 | 114 KB |
| `campus-harvard-widener.webp` | `4936d113…` | 660×440 | 84 KB |
| `campus-mit-dome.webp` | `d9761146…` | 660×495 | 87 KB |
| 6 × `.woff2` | see §4 | — | 299 KB total |

---

## 2. Stack **[DEPARTURE — version]**

The brief specifies **Astro 5**. Current is **Astro 7.1.5**, and
`@astrojs/cloudflare@14.1.6` declares `peerDependencies: { astro: "^7.0.0" }`.
"Astro 5 + a current Cloudflare adapter" is not a combination that exists — Astro 5
would pin the adapter to the 13.x maintenance line. The brief anticipated this
("check the current Astro and Cloudflare docs before scaffolding rather than
guessing at adapter config"), so the build targets **Astro 7**.

Verified against current docs, nothing else in the brief's stack changes:
`output: 'server'` is still valid, per-route `export const prerender = true` is
unchanged, and content collections are unchanged. Astro 7's notable deltas are a
stricter Rust compiler (unclosed tags now error), `compressHTML: 'jsx'`, and the
Sätteri markdown processor (`@astrojs/mdx@7` peers on `@astrojs/markdown-satteri`).

| Piece | Version | Note |
|---|---|---|
| astro | 7.1.5 | strict TS |
| @astrojs/cloudflare | 14.1.6 | `output: 'server'`, per-route prerender |
| @astrojs/react | 6.0.2 | React 19.2.8 islands |
| tailwindcss + @tailwindcss/vite | 4.3.3 | tokens in `@theme` |
| @astrojs/mdx + @astrojs/markdown-satteri | 7.0.5 / 0.3.x | policy + service MDX |
| @astrojs/sitemap | 3.7.3 | |
| stripe | 22.3.2 | needs `nodejs_compat` |
| resend | 6.18.1 | transactional email |
| zod | 4.4.3 | shared client/server validation |
| wrangler | 4.115.0 | Workers + static assets |

**[DEPARTURE — package manager]** `pnpm` is not installed in this environment. The
brief allows npm ("your call, just be consistent and commit the lockfile"). Using
**npm**, committing `package-lock.json`, exposing `npm run deploy`.

Cloudflare target: **Workers with static assets** (not Pages) — `wrangler.jsonc`
with an `assets` binding, `compatibility_flags: ["nodejs_compat"]`,
`compatibility_date: "2026-07-28"`, `not_found_handling: "404-page"`.

---

## 3. Design tokens (extracted, not invented)

### Color

| Token | Hex | Use in prototype |
|---|---|---|
| `maroon` | `#560F10` | headings, primary buttons, dark bands |
| `maroon-deep` | `#38090D` | footer bg, mobile overlay, text on gold |
| `maroon-hover` | `#6E1620` | button hover |
| `maroon-link` | `#8A1B26` | link hover |
| `gold` | `#D8A13A` | accent, CTA bg, rules, focus ring |
| `gold-hover` | `#E0B054` | gold CTA hover |
| `gold-dark` | `#8A6420` | eyebrow / label text |
| `cream` | `#F0DFB4` | text on maroon |
| `cream-light` | `#EFDCAE` | |
| `bg` | `#FAF7F1` | page background, input fill |
| `ink` | `#2E2B29` | body text |
| `flag` | `#B0492F` | draft-copy markers — **dev only** |

Derived values used repeatedly: hairline `rgba(86,15,16,.14)`, input border
`rgba(86,15,16,.25)`, muted ink `rgba(46,43,41,.55–.85)`, gold rule on maroon
`rgba(216,161,58,.25)`, cream muted `rgba(240,223,180,.5–.8)`.

### Type

- **Newsreader** (serif) — headings/display, weights 400/500/600.
- **Public Sans** (sans) — body/UI, weights 400/500/600/700.

Scale observed: hero 62px/1.06/-.015em · h1 44–52px · h2 36–42px · section head 40px ·
card title 28–30px · lede 17–18px/1.65 · body 15–17px · label/eyebrow 11–12px
600 weight `.14em` tracking uppercase · policy body 17.5px/1.65.

Both families ship as **variable** woff2 (one file serves every weight), in three
Google subsets each — `latin`, `latin-ext`, `vietnamese` — with `unicode-range`
copied verbatim from the prototype's `<helmet>`. Self-hosted, `font-display: swap`,
no runtime Google Fonts request.

### Motion

```css
@keyframes rise   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
@keyframes drawin { from { stroke-dashoffset:900 } to { stroke-dashoffset:0 } }
```
`rise` easing `cubic-bezier(.22,1,.36,1)`, durations .4–.6s, stagger .06s (mobile nav)
and .15/.3/.45/.6/.7s (hero). `drawin` 1.1s .2s for the hero route path. Both wrapped
in `@media (prefers-reduced-motion: reduce)`.

### Layout

Max widths 1240px (most) / 1440px (header, home hero + waypoints) / 1080px (checkout) /
880px (centred prose) / 760px (inquiry) / 720px (thank-you) / 68ch (policy prose).
Gutters 48px. Card radius 6px, button/input radius 4px. Header height 76px, sticky
`top-0`, `rgba(250,247,241,.92)` + `blur(8px)`. Sticky sidebars at `top:104px`.

---

## 4. Fonts — subset map

| Family | Subset | File | unicode-range (verbatim from prototype) |
|---|---|---|---|
| Newsreader | vietnamese | `newsreader-vietnamese.woff2` | `U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB` |
| Newsreader | latin-ext | `newsreader-latin-ext.woff2` | `U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF` |
| Newsreader | latin | `newsreader-latin.woff2` | `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD` |
| Public Sans | vietnamese | `public-sans-vietnamese.woff2` | same as Newsreader vietnamese |
| Public Sans | latin-ext | `public-sans-latin-ext.woff2` | same as Newsreader latin-ext |
| Public Sans | latin | `public-sans-latin.woff2` | same as Newsreader latin |

Only the two `latin` files are `<link rel="preload">`ed.

---

## 5. Routes

Prototype `state.route` → real URL. Bearing values are read from the `bearings` map
in the prototype's `renderVals()`; labels from the `labels` map.

| URL | Prototype route | Bearing | Label | Render |
|---|---|---|---|---|
| `/` | `home` | 0° | HOME | prerender |
| `/services` | `services` | 41° | SERVICES | prerender |
| `/services/counseling-bundle` | `svc-bundle` | 49° | SERVICES | prerender |
| `/services/essay-review` | `svc-essay` | 58° | SERVICES | prerender |
| `/services/essay-reviews-5` | `svc-pack5` | 66° | SERVICES | prerender |
| `/services/zoom-followups-5` | `svc-zoom5` | 74° | SERVICES | prerender |
| `/services/rush-consultation` | — **new** | 80° | SERVICES | prerender |
| `/about` | `about` | 87° | ABOUT | prerender |
| `/book` | `book` | 122° | BOOK | prerender |
| `/contact` | `contact` | 164° | CONTACT | prerender |
| `/inquiry` | `inquiry` | 203° | INQUIRY | prerender |
| `/checkout/[product]` | `checkout` | 231° | CHECKOUT | **server** |
| `/policies/refunds` | `p-refunds` | 245° | POLICIES | prerender |
| `/policies/scope` | `p-scope` | 262° | POLICIES | prerender |
| `/policies/privacy` | `p-privacy` | 279° | POLICIES | prerender |
| `/policies/terms` | `p-terms` | 296° | POLICIES | prerender |
| `/thank-you` | `thanks` | 318° | CONFIRMED | **server** |
| `/404` | — **new** | 0° | NOT FOUND | prerender |

`/services/rush-consultation` has no prototype counterpart — the brief requires it so
rush goes through the same acknowledgement gate as the other four. 80° sits in the
services arc after `svc-zoom5` (74°) and before `about` (87°).

Server endpoints (the only Worker-executed code):
`POST /api/contact` · `POST /api/newsletter` · `POST /api/inquiry` ·
`POST /api/checkout` · `POST /api/stripe-webhook`.

### Compass bearing indicator — keep

Real design element, ported as a React island. From the prototype:

```js
const deg = ((bearings[route] || 0) + Math.min(40, scrollY / 30)) % 360;
bearingText = String(Math.round(deg)).padStart(3,'0') + '° · ' + labels[route];
needleStyle = { transform:'rotate('+deg+'deg)', transformOrigin:'13px 13px',
                transition:'transform .3s cubic-bezier(.22,1,.36,1)' };
```
rAF-throttled, `{ passive: true }` scroll listener, cleaned up on unmount. The 26px
SVG dial (circle r=12, four tick marks, needle polygon `13,4.5 15,13 13,21.5 11,13`,
gold hub r=1.6) is copied verbatim. Label `min-width:110px` to prevent reflow.

---

## 6. Products

Canonical set. Prices must match the Stripe Price objects; the site never sends an
amount, only a slug that maps to a `STRIPE_PRICE_*` env var.

| Slug | Name | Price | Stripe mode | Payment methods |
|---|---|---|---|---|
| `counseling-bundle` | University Counseling Bundle | $2,750.00 / 3 months | `subscription` | **ACH first**, then card |
| `essay-review` | 1 Application / Essay Review | $300.00 | `payment` | **card only** |
| `essay-reviews-5` | 5 Additional Essay Reviews | $775.00 | `payment` | card + ACH |
| `zoom-followups-5` | Five Additional Zoom Follow-Ups | $725.00 | `payment` | card + ACH |
| `rush-consultation` | Rush consultation fee | $100.00 | `payment` | card only (speed promise) |

Rationale carried from the brief: ACH is 0.8% capped at $5 vs card 2.9% + $0.30
(~$5 vs ~$80 on a $2,750 renewal), but ACH settles in days — and the essay
turnaround is advertised as starting "at submission and payment", so ACH on essay
products would break a written promise.

Copy per product (`kind` / `lede` / `includes[]` / `how` / `billingNote` / `termNote` /
`cta` / `desc`) is lifted verbatim from the `products` object in the prototype's
`renderVals()` into `src/content/services/*.mdx`. `rush-consultation` copy is
assembled from the prototype's services-index card and `/book` EVENT TYPE 02 panel,
which are its only appearances.

---

## 7. Page-by-page content

### `/` Home
Eyebrow "Independent college admissions consulting · Southern California" ·
h1 "Every college is within your reach" (nbsp before "reach") · lede "From first
draft to acceptance letter…" · CTAs "Book a free consultation" + "Explore services" ·
"30 minutes, free, no obligation." **[DRAFT]**
Hero route SVG: path `M40 410 C 180 370, 200 292, 320 262 S 520 175, 620 78`,
`stroke-dasharray="1 7"`, 4 waypoint circles, labels SOPHOMORE PLAN / JUNIOR TESTING /
ESSAY DRAFTS / DECISIONS, crest at 185px.
Then: 3 waypoint strip (Annual planning session / Essay reviews, line by line /
Follow-up Zoom sessions) · "Our approach" prose · maroon THE ROUTE band (crest 300px +
4 numbered rows) · "Two ways to work together" (bundle + essay cards) · founder strip
**[DRAFT: condensed from supplied bio]** · 4 campus tiles + disclaimer · CTA band.

### `/services`
h1 "Clear engagements, clearly priced" · intro · bundle card (maroon) + essay card
(white), each with 3 bullets · three add-on cards · refund-policy summary block.
**[CHANGE]** the rush card's "Book rush" link → `/services/rush-consultation`
(prototype pointed at `book`).

### `/services/[slug]`
Back link "← ALL SERVICES" · kind eyebrow · name · lede · "What's included" numbered
list · "How it works" (when non-empty) · add-on note (when `addon: true`) · refund
policy · sticky purchase rail: price, term, billing note, **refund-acknowledgement
checkbox gate**, CTA, "Not sure? Book a free consultation", Stripe reassurance line.

### `/about`
"Sam Atherton / Founder and President" · 3 paragraphs (2 carry **[DRAFT]**) · founder
photo + caption · three columns Graduate study / Undergraduate study / Roles ·
maroon pull-quote band + CTA.

### `/book` **[REDESIGN — required by brief]**
Prototype has a two-card EVENT TYPE selector (01 free / 02 rush). With one bookable
event type that selector is wrong. Rebuilt as: cal.com embed as primary content,
"WE'LL ASK WHEN YOU BOOK" panel, and rush as a **secondary explanatory panel** linking
to `/services/rush-consultation` — not a booking widget. Embed failure fallback kept
verbatim ("The scheduler didn't load" + direct cal.com link + phone).

### `/contact`
h1 "We're here to help" · email/phone/inquiry links · 4-field form
(first, last, email, message).

### `/inquiry`
4 steps — About you / Contact / Academic / Interests — with the dashed-route progress
indicator (`✓` for done, `01`–`04`, gold dashed connector). Carries the
**[RECOMMENDATION: drop street address…]** marker. Newsletter opt-in on step 4,
unchecked, separate.

### `/policies/*`
Sticky policy nav (4 links, active = gold left border + 600 weight). Scope page also
renders an "ON THIS PAGE" list of its 10 headings. Refunds · Scope (10 sections,
5 **[DRAFT]**) · Privacy (whole page **[DRAFT]**) · Terms (whole page **[DRAFT]**).

### `/thank-you`
Server-verifies `session_id` via `stripe.checkout.sessions.retrieve` before rendering.
✓ badge · "Payment confirmed" · "WHAT HAPPENS NEXT" 3 steps **[DRAFT]**. Rush
purchases swap step 01 for the `RUSH_RESPONSE_HOURS` commitment.

### Footer / header / mobile nav
Footer: crest 88px, 4 columns (brand / EXPLORE / POLICIES / CONTACT + newsletter),
disclaimer + © line. Mobile overlay: `#38090D` full-screen, 44px serif links with
`rise` stagger, contact line pinned bottom.

---

## 8. Form states (preserve exact copy)

| Form | State | Copy |
|---|---|---|
| Contact | pending | "Sending…" / "Your message is on its way." |
| | success | ✓ "Message sent" / "Thank you — we'll reply within one business day." / "Send another message" |
| | error | ! "That didn't go through" / "Your message wasn't sent. Please try again — or call us directly at (949) 209-9962." / "Try again" |
| Newsletter | pending | "Subscribing…" |
| | success | "✓ Subscribed — welcome aboard." |
| | error | "That didn't go through — try again or email us directly." |
| Inquiry | success | ✓ "Inquiry received" / "Thank you — we'll review your information and reply within one business day. If anything is time-sensitive, call us at (949) 209-9962." / CTA "Book your free consultation" |

Every error state surfaces the phone number. Status changes announced via `aria-live`.
Inquiry answers persist across step navigation **and reload** (`sessionStorage`,
local-only, named in the privacy policy).

Inquiry fields — step 1: firstName, lastName, birthdate, firstGen (y/n), military (y/n) ·
step 2: email, phone, addr1, addr2, city, state, zip · step 3: institution, ceeb,
applyingAs (first-year/transfer), entryTerm (Fall 2026–2029) · step 4: interest1–3,
newsletter consent.

---

## 9. Integrations

### Stripe
- `POST /api/checkout` — slug in, Price ID from env, Checkout Session out, 303 redirect.
  Never accepts a client amount.
- `mode`: `subscription` for the bundle, `payment` for the rest.
- Billing address collected; `customer_email` when known; statement descriptor
  `UNIV NAVIGATOR`.
- **Stripe Tax OFF** — commented stub only; CA generally exempts professional
  consulting where no tangible product changes hands. Question logged for the CPA.
- Refund acknowledgement is a **pre-checkout gate on the product page**; the boolean
  and an ISO timestamp ride in Session `metadata` as chargeback evidence.
- `POST /api/stripe-webhook` — `constructEventAsync()` (the sync `constructEvent` uses
  Node crypto and fails on Workers), raw body read as text before parsing, handles
  `checkout.session.completed`, idempotent.
- `/thank-you?session_id=…` retrieves and verifies server-side; the query param alone
  is never trusted.
- **Two emails, deliberately**: Stripe's own receipt (proof of payment, invoice PDF,
  dispute evidence — not suppressed, not rebuilt) plus a Resend welcome email from the
  webhook restating the refund policy verbatim.
- **Internal notification** to `INTERNAL_NOTIFY_EMAIL` on every purchase — product,
  customer name/email, acknowledgement timestamp. **Rush marked urgent in the subject.**
- Customer Portal required (payment-method updates + cancellation).
- Dashboard-only setup documented in README: receipts, Subscription Management /
  near-one-click cancel (**CA Automatic Renewal Law** — highest compliance risk),
  upcoming-renewal emails, failed-payment emails, Smart Retries, branding.

### cal.com — free consultation ONLY
One event type, 30 min, video, free. Official embed, lazy-loaded, palette-themed,
keyboard navigable, with the prototype's failure fallback on timeout. No paid event
types, no Stripe app on cal.com, no paid-booking edge cases. Named as a subprocessor
in the privacy policy (it stores data about minors). Free tier is sufficient.

### Forms
Turnstile on all three, server-side siteverify every submission. Resend for delivery.
Zod schemas shared client/server. No third-party form service, no persistence.

### Explicitly NOT built
No session-entitlement system, credit balance, private booking links, client portal,
or scheduling surface for paid clients. The webhook notification is the entire
technical handoff to the office.

---

## 10. Privacy

Collects data about **minors** (names, birthdates, addresses, school,
first-generation status, U.S. military status). Therefore: form values excluded from
logs/error reports/analytics; email-only delivery, no third-party form storage; no
analytics or trackers by default (Cloudflare Web Analytics left as a commented stub);
strict CSP allowing only what cal.com and Stripe need. The prototype's inline
recommendation to drop street address is **recorded in CONTENT-REVIEW.md and not
acted on** — the client chose to ship as designed.

---

## 11. Draft-copy handling

`[DRAFT COPY — REVIEW]` / `[RECOMMENDATION: …]` markers move into content files
verbatim, entries get `needsReview: true`, markers render **only** when
`import.meta.env.DEV`, and every flagged passage is listed in `CONTENT-REVIEW.md`.

Flagged passages: home hero "30 minutes, free, no obligation." · home founder strip ·
about ×2 · inquiry address recommendation · thank-you "what happens next" ·
scope §Limitations, §Entire Agreement, §Independent Research, §Family Participation,
§Change in Scope, §Communications · privacy (whole page) · terms (whole page).

---

## 12. Quality bar

Mobile-first (prototype is desktop-only: fixed `600px 1fr` grids, 62px hero).
WCAG 2.1 AA — semantic landmarks, gold `2px` focus outline at `2px` offset,
`aria-live` on form status, `prefers-reduced-motion` honored. Gold-on-cream and
gold-dark-on-bg contrast checked and darkened where they fail. Per-route SEO
(title/description/OG/Twitter/canonical), `sitemap.xml`, `robots.txt`, JSON-LD
(`ProfessionalService`, `Service`+`Offer` per package, `Person`). Lighthouse 95+ ×4.
JS ships only for islands: compass, mobile nav, cal embed, 3 forms, ack gate.

---

## 13. Contact

`info@universitynavigator.org` · (949) 209-9962 · © 2026 University Navigator, Inc.
