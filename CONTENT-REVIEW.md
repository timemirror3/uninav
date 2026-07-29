# Content review — sign-off needed before launch

Every passage below is either **flagged in the prototype** as draft copy, or **new
copy written during the build** because the prototype had no equivalent. Nothing
here is a blocker for deploying to a staging URL; all of it should be settled
before the site is pointed at `universitynavigator.org`.

**How the flags behave.** `[DRAFT COPY — REVIEW]` and `[RECOMMENDATION: …]` markers
render **only in development** (`npm run dev`). They are not merely hidden in
production — the markup is never emitted. Verify with:

```bash
npm run build && grep -r "DRAFT COPY" dist/client/   # expect no matches
```

Entries carrying flags have `needsReview: true` in their content frontmatter.

---

## 1. Legal and compliance — highest priority

### 1.1 California Automatic Renewal Law · **needs counsel**

This is the highest-compliance-risk part of the build: a California company
auto-renewing a **$2,750 quarterly** charge for California families. California's
Automatic Renewal Law (Bus. & Prof. Code § 17600 et seq.) and the FTC's
negative-option rule both apply, and both have teeth.

The build does what it can in code — the renewal terms are stated next to the
purchase button, in the order summary, in the welcome email, and in the Terms —
but the compliance-critical piece is **dashboard configuration**, not code:

- **Subscription Management / near one-click cancellation must be enabled** in
  Stripe. See README § "Stripe Dashboard setup".
- The Customer Portal link must reach the customer. It is included in the bundle
  welcome email via `STRIPE_PORTAL_URL`; **if that variable is unset the email
  falls back to "email us to cancel", which is exactly the friction the law is
  aimed at.** Set it.

**Action:** have counsel confirm the consent flow, the renewal-reminder cadence,
and the cancellation path before taking a live subscription payment.

### 1.2 Stripe Tax is OFF · **needs the owner's CPA**

`automatic_tax` is deliberately **not** enabled. California generally exempts
professional consulting services where no tangible product changes hands, so
enabling Tax would cost 0.5% per transaction to collect tax that most likely is
not owed.

A commented stub sits in `src/pages/api/checkout.ts` — search for
`Stripe Tax is deliberately NOT enabled`. Uncommenting two lines turns it on.

**Action:** confirm with the CPA whether any of the five products is taxable in
California (or in any state where a client might be billed). If yes, enable the
stub and re-test.

### 1.3 Subscription shape — open-ended vs fixed-cycle · **owner's call**

Implemented **open-ended**: renews quarterly until cancelled, with the Stripe
Customer Portal handling cancellation. That matches the prototype's copy
verbatim — *"Renews quarterly via Stripe. Cancel anytime before renewal."*

The alternative is a **fixed-cycle subscription schedule** that auto-ends after a
set number of quarters (e.g. four, covering one admissions cycle). That reduces
ARL exposure and surprise-renewal disputes, at the cost of manual renewal when a
family wants to continue.

**Action:** confirm open-ended is intended. If not, this becomes a Stripe
Subscription Schedule and the copy in `src/lib/products.ts` (`billingNote`,
`termNote`) and `src/content/policies/terms.mdx` must change with it.

### 1.4 Street address on the inquiry form · **recorded, not acted on**

The prototype carries this note inline:

> `[RECOMMENDATION: drop street address at inquiry stage — city/state suffices.`
> `Kept optional here pending your call.]`

The client chose to **ship as designed**, so `addr1` / `addr2` remain on step 2 of
the Request for Information, optional, exactly as drawn. Nothing was changed.

Worth restating plainly: this form routinely collects a **minor's** name,
birthdate and street address. The build minimises the blast radius — submissions
are emailed and never persisted, no field value is written to any log, and the
draft in the browser uses `sessionStorage` so it dies with the tab — but the data
still lands in an email inbox. If that inbox is not access-controlled, the
recommendation is worth revisiting.

**Location:** `src/pages/inquiry.astro`, `src/lib/schemas.ts` (`inquiryStep2`).

---

## 2. Prototype passages flagged `[DRAFT COPY — REVIEW]`

| # | Passage | File | What needs deciding |
|---|---|---|---|
| 2.1 | "30 minutes, free, no obligation." | `src/pages/index.astro` (hero) | Confirm the consultation really is 30 min and unconditional — it is a promise made above the fold. |
| 2.2 | Founder summary — "a professor at Mt. San Antonio College and a USC recruiter, with degrees from USC, UC Berkeley, and graduate studies at Harvard." | `src/pages/index.astro` (founder strip) | Marked in the prototype as *condensed from supplied bio*. Confirm the condensation is accurate and that naming USC/Harvard this way is acceptable to those institutions. |
| 2.3 | "His international experience spans more than 20 countries…" | `src/pages/about.astro` | Marked *closing paragraphs condensed from source*. Confirm the country count. |
| 2.4 | "University Navigator, Inc. is committed to guiding every student with clarity, candor, and care — and never guarantees admissions outcomes." | `src/pages/about.astro` | Confirm wording. |
| 2.5 | "What happens next" — the three post-payment steps | `src/pages/thank-you.astro` | These are operational commitments ("within one business day", "72-hour turnaround"). Confirm the office can meet them. |
| 2.6 | Scope § **Scope Limitations** | `src/content/policies/scope.mdx` | Counsel. |
| 2.7 | Scope § **Entire Agreement Clause** | `src/content/policies/scope.mdx` | Counsel — an entire-agreement clause that supersedes prior representations is a substantive term. |
| 2.8 | Scope § **Independent Research** | `src/content/policies/scope.mdx` | Counsel. |
| 2.9 | Scope § **Family Participation Clause** | `src/content/policies/scope.mdx` | Counsel — this governs communications about a minor. |
| 2.10 | Scope § **Change in Scope** | `src/content/policies/scope.mdx` | Counsel. |
| 2.11 | Scope § **Communications Policy** | `src/content/policies/scope.mdx` | Confirm the 72-hour turnaround commitment and that `info@universitynavigator.org` is the intended single channel. |
| 2.12 | **Privacy policy — entire page** | `src/content/policies/privacy.mdx` | Marked *entire page drafted; owner/counsel to approve*. See §3.1 for what the build added. |
| 2.13 | **Terms of service — entire page** | `src/content/policies/terms.mdx` | Marked *entire page drafted; owner/counsel to approve*. See §3.2. |

---

## 3. New copy written during the build

The prototype had no equivalent for the following. It is written in the
prototype's voice but is **not** the client's words and has not been approved.

### 3.1 Privacy policy — two new sections

The brief required both, and neither existed in the prototype:

- **"Information stored in your browser"** — discloses the `sessionStorage` draft
  on the inquiry form. Required because the form now persists across reload.
- **"Service providers"** — names Stripe, **Cal.com**, Resend and Cloudflare.
  Cal.com is named explicitly as processing information about minors on the
  firm's behalf, as the brief requires.

**Action:** counsel should confirm the subprocessor list is complete and
accurately described. If a mailing-list tool is added later (the newsletter opt-in
currently just emails the office), it must be added here.

### 3.2 Terms of service — new "Cancellation" section

Added because the Customer Portal exists and ARL compliance (§1.1) depends on the
cancellation path being stated in writing. Points at `STRIPE_PORTAL_URL`.

**Action:** counsel review alongside §1.1.

### 3.3 Rush consultation detail page — new page

`/services/rush-consultation` has no prototype counterpart. The brief requires it
so rush passes through the same refund-acknowledgement gate as the other four
products, giving uniform dispute evidence.

Its copy is assembled from the only two places rush appears in the prototype: the
`/services` card ("Applies to meetings scheduled outside current availability.
Limited, case-by-case." / "Paid at booking.") and the `/book` EVENT TYPE 02 panel
("30 minutes · covers meetings outside current availability, subject to limited
case-by-case availability · paid at booking").

**One sentence in it is a genuinely new commitment** and needs sign-off:

> "Rush requests are accommodated where the schedule allows. **If we cannot find a
> time, the fee is refunded in full.**"

This is not in the prototype and it is not implied by the refund policy — in fact
the refund policy's "no refunds after 7 days" would contradict it if a rush
request went unfilled for longer than a week. **Either confirm this promise and
make sure the office honours it, or remove the sentence.**

**Location:** `src/content/services/rush-consultation.mdx` (`includes[1].d`).

### 3.4 `RUSH_RESPONSE_HOURS` — currently **24**

Rush purchasers get a specific commitment rather than the generic one-business-day
line, because they paid a premium for speed and are then waiting on an inbox. The
thank-you page and welcome email both state it, and the internal notification
subject is prefixed `[URGENT — 24h]`.

Changeable **without a redeploy** via the `RUSH_RESPONSE_HOURS` environment
variable; the fallback default also sits in
`src/content/services/rush-consultation.mdx` (`responseHours`).

**Action:** confirm 24 hours is a commitment the office can actually keep,
including over weekends. If not, raise it — an unmet number is worse than a
vaguer one.

### 3.5 404 page — new page

The prototype has none; the brief requires one. Copy: *"That page isn't on the
map"* plus navigation. Voice-check only.

### 3.6 Thank-you page — two new states

The prototype only drew the success state. Two more were required:

- **"Payment processing"** — ACH bank transfers can land on the thank-you page
  before settling. Without this the customer would see an error after a
  successful action.
- **"We couldn't confirm this order"** — shown when `session_id` is missing,
  malformed, or does not verify server-side.

Voice-check only; both are operationally necessary.

### 3.7 `/book` page — rebuilt, as the brief directs

The prototype's two-card EVENT TYPE selector (01 free / 02 rush) is gone: with one
bookable event type a selector is wrong. The free-consultation embed is now the
primary content and rush is a secondary explanatory panel linking to
`/services/rush-consultation`. The embed-failure fallback copy is preserved
verbatim. Some connective copy in the rush panel is new — voice-check.

---

## 4. Decisions taken during the build

Recorded here because the brief asked that judgement calls be written down. None
of these change what the prototype promises customers.

### 4.1 Contrast corrections — **three prototype pairings failed WCAG AA**

Measured, not assumed:

| Prototype value | Context | Ratio | Result |
|---|---|---|---|
| `rgba(46,43,41,.55)` on `#FAF7F1` | 11–13px captions | **3.34:1** | fails AA (needs 4.5) |
| `rgba(46,43,41,.6)` on `#FAF7F1` | 12–13px secondary text | **3.83:1** | fails AA |
| `rgba(240,223,180,.5)` on `#38090D` | footer © line | **4.06:1** | fails AA |
| `#8A6420` on `#FAF7F1` | eyebrow labels | 5.00:1 | passes (kept as-is) |
| `#D8A13A` on `#560F10` | gold on maroon | 6.17:1 | passes |
| `#F0DFB4` on `#560F10` | cream on maroon | 10.82:1 | passes |

Darkened into named tokens: `--color-ink-muted` `#6B6763` (5.24:1),
`--color-ink-soft` `#55524F` (7.26:1), `--color-cream-muted` `#BFAE87` (7.93:1 on
the footer). The hue is unchanged — only lightness moved, by the minimum needed to
clear 4.5:1.

Separately: **gold `#D8A13A` on cream `#F0DFB4` measures 1.75:1** and must never be
used for text. It does not occur as a text pairing in the prototype and does not
occur in the build; noted so it is not introduced later.

### 4.2 Astro 7, not Astro 5

The brief specifies Astro 5. `@astrojs/cloudflare@14` declares
`peerDependencies: { astro: "^7.0.0" }`, so "Astro 5 with a current Cloudflare
adapter" is not a combination that exists — Astro 5 would pin the adapter to the
13.x maintenance line. Built on Astro 7.1.5. `output: 'server'`, per-route
`prerender`, content collections and `astro:assets` are all unchanged.

### 4.3 npm, not pnpm

pnpm is not installed in the build environment; the brief allows either.
`package-lock.json` is committed. The deploy script is `npm run deploy`.

### 4.4 Payment methods per product

ACH Direct Debit is enabled and presented first on the **bundle** only
(0.8% capped at $5 versus 2.9% + $0.30 on cards — roughly $5 against $80 on a
$2,750 renewal). It is **withheld from both essay products and rush**, because ACH
settles in days and the site advertises a 72-hour turnaround starting *"at
submission and payment"*. Offering ACH there would put the firm in breach of a
written promise before work began. The 5-Zoom add-on allows ACH (no turnaround
promise attached).

### 4.5 Webhook idempotency is in-memory

The Stripe webhook de-duplicates replays using an in-isolate `Set` of event IDs.
This covers the common case — Stripe retrying within seconds while the isolate is
warm — without adding a KV or D1 dependency the brief does not call for. A retry
arriving on a **cold** isolate would re-send the welcome email. Accepted
trade-off; if duplicate welcome emails are ever reported, the fix is a KV binding
keyed on `event.id`. Also noted in the README.

---

## 5. Pre-launch checklist

- [ ] §1.1 ARL / cancellation flow reviewed by counsel; `STRIPE_PORTAL_URL` set
- [ ] §1.2 Stripe Tax question answered by the CPA
- [ ] §1.3 Open-ended vs fixed-cycle subscription confirmed
- [ ] §1.4 Street-address recommendation accepted or revisited
- [ ] §2 all thirteen flagged passages approved
- [ ] §3.3 the rush full-refund sentence confirmed **or removed**
- [ ] §3.4 `RUSH_RESPONSE_HOURS` confirmed as achievable
- [ ] §3.1 subprocessor list confirmed complete
- [ ] Five Stripe Prices created and the five `STRIPE_PRICE_*` values set — amounts
      matching `src/lib/products.ts` exactly
- [ ] `grep -r "DRAFT COPY" dist/client/` returns nothing

---

## 6. Measured results (for the record)

Lighthouse 12, desktop preset, against the production build: **99–100 across all
four categories on every route except two**, both explained in README §
"Measured quality" — `/book` best-practices (cal.com's own third-party cookies and
an error caused by the placeholder cal link 404ing) and `/404` SEO (the
intentional `noindex`).

Accessibility is **100 on every route**. Getting there required two fixes beyond
the design source, both noted in §4.1:

- Gold `#D8A13A` was used for the numbered markers on the service detail pages and
  the thank-you steps, where it sits on a light surface at **2.16:1**. Changed to
  `gold-dark` `#8A6420` (5.00:1). Gold on maroon (6.17:1) is unchanged.
- Tailwind's preflight sets `text-decoration: inherit` on anchors, which stripped
  underlines from inline prose links. Those links then differed from body text by
  colour alone — maroon against ink — failing WCAG 1.4.1. Underlines restored in
  the base layer; navigation, buttons and cards opt out with `no-underline`.
