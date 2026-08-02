# Launch checklist

What stands between this repo and a live, paying site. Written 2026-08-02 after a
full end-to-end payment test against a Stripe sandbox (`Andres LLC sandbox`,
`acct_1U05ipJmZVdAu96T`).

**The code is ready. The configuration and the sign-offs are not.** Nothing below
is a code change except §5.

Companion documents: `README.md` (how the stack works), `CONTENT-REVIEW.md` (the
legal and compliance sign-offs, summarised in §6).

---

## What has actually been proven to work

Verified against the sandbox, not assumed:

- Checkout Session creation for **all five** products — amounts, `mode`, and
  `payment_method_types` each match `src/lib/products.ts` exactly.
- The refund gate rejects `refundAck: false` and unknown product slugs (400).
- A **complete $100 card payment**: product page → form POST → 303 → Stripe
  Checkout → `succeeded` → `/thank-you` → webhook delivered and handled (200).
- Webhook signature verification on Workers (`constructEventAsync` + raw body
  read before parsing — the two things that silently break on workerd).
- Chargeback evidence lands in metadata **and is copied onto the PaymentIntent**,
  not just the Session: `refund_policy_acknowledged`, its timestamp, 155 chars of
  policy text, `product_slug`, `is_rush`.
- Statement descriptor renders as `UNIV NAVIGATOR`.
- `/thank-you` reads `is_rush` from metadata and shows the `RUSH_RESPONSE_HOURS`
  commitment rather than the generic line.
- Contact form → Resend → delivered.
- Layout holds at 1512px and 414px; no overflow, clipping, or broken hierarchy.

## What has never run

Be aware these are unproven, not known-good:

- [ ] **A subscription has never completed.** The $2,750 Session was created and
      inspected, but no recurring payment was taken. Renewal, proration,
      cancellation, and the ARL renewal emails are all untested.
- [ ] **ACH / `us_bank_account` has never been used**, on any product.
- [ ] **The two purchase emails have never rendered** — `welcomeEmail` and
      `internalPurchaseNotification`. Both 401'd during the payment test (the
      Resend key was still a placeholder at that point) and no purchase has run
      since a working key was added.
- [ ] **Inquiry (RFI) and newsletter emails** have never been sent. Only
      `/api/contact` was exercised.
- [ ] **The Customer Portal cancellation flow** has never been opened.

---

## 1. Credentials — all currently placeholder or test-mode

`.dev.vars` is local only. Production values go in as Worker secrets (§3).

| Variable | Current | Needed |
|---|---|---|
| `STRIPE_SECRET_KEY` | sandbox `sk_test_…` | `sk_live_…` |
| `STRIPE_PRICE_*` (×5) | sandbox price IDs | live Price IDs — **create by hand**, see §2 |
| `STRIPE_WEBHOOK_SECRET` | CLI `whsec_…` | the **dashboard endpoint's** `whsec_…`, which is a different value |
| `RESEND_API_KEY` | test key, works | production key |
| `TURNSTILE_SECRET` | `1x0000…` **test — always passes** | the real secret paired with site key `0x4AAAAAAEE…` |
| `STRIPE_PORTAL_URL` | `…/p/login/replace_me` | the real Customer Portal login link |
| `FROM_EMAIL` | `onboarding@resend.dev` (test) | `info@universitynavigator.org`, **after** domain verification |
| `INTERNAL_NOTIFY_EMAIL` | a personal gmail (test) | `info@universitynavigator.org` |

Two of these are easy to get wrong and silent when you do:

- **Turnstile is currently a real site key with a test secret.** The widget
  renders and issues genuine tokens, but siteverify always returns success. The
  forms look protected and are not.
- **Resend has zero verified domains.** Until `universitynavigator.org` is
  verified, `info@…` cannot send at all — that is why `FROM_EMAIL` is pointed at
  `onboarding@resend.dev`, which only delivers to the account owner's own address.
  Verify the domain, then revert both `FROM_EMAIL` and `INTERNAL_NOTIFY_EMAIL`.

## 2. Live Stripe Prices — create by hand

`scripts/seed-stripe.mjs` **deliberately refuses live keys**; seeding is a test
operation. Create these five in the live Dashboard, matching
`src/lib/products.ts` exactly. A mismatch between the displayed price and the
Price object is a consumer-protection problem, not a cosmetic one.

| Product | Amount | Billing |
|---|---|---|
| University Counseling Bundle | $2,750.00 | recurring, every 3 months |
| 1 Application / Essay Review | $300.00 | one-time |
| 5 Additional Essay Reviews | $775.00 | one-time |
| Five Additional Zoom Follow-Ups | $725.00 | one-time |
| Rush consultation fee | $100.00 | one-time |

Consider adding a product image to each — Checkout's left panel is otherwise
sparse, which reads as low-trust on a $2,750 recurring purchase.

## 3. Deploy

- [ ] `npx wrangler secret put …` for every variable in §1.
- [ ] **Pick the right Cloudflare account** — the CLI is authenticated against
      four. This project belongs to `Andreslopez.23061@gmail.com's Account`
      (`0bda3a2560ca48711ef7336cc421abed`).
- [ ] Create the live webhook endpoint at
      `POST https://universitynavigator.org/api/stripe-webhook`, subscribed to
      `checkout.session.completed`, and copy **that endpoint's** signing secret.
- [ ] `npm run preflight` and confirm it reports live mode with no warnings.
- [ ] Confirm `https://cal.com/university-navigator-lb9xx8/30min` resolves — a 404
      makes cal.com's embed script throw.

## 4. Stripe Dashboard settings

### 4.1 Branding — currently completely unset

Verified via the API: no icon, no logo, no colours, no support details, and the
business name reads `Andres LLC sandbox`.

This is not only cosmetic. The name appears in the recurring-payment
authorisation directly under the Subscribe button:

> "By subscribing, you authorize **Andres LLC sandbox** to charge you according
> to the terms until you cancel."

That is the entity name a customer sees at the moment they authorise a recurring
$2,750 charge — the same "I don't recognise this" risk the `STATEMENT_DESCRIPTOR`
comment in `src/lib/stripe.ts` exists to avoid, and the disclosure moment
California's ARL cares about most.

| Setting | Value |
|---|---|
| Public business name | University Navigator, Inc. |
| Icon + logo | the crest in `public/` |
| Brand colour | `#560f10` |
| Accent colour | `#d8a13a` |
| Support email / phone / website | `info@universitynavigator.org` / `(424) 404-3686` / the live domain |

Set these on the **live** account. Branding is per-account and does not carry
over from the sandbox.

### 4.2 Payment methods — Link is overriding the card-only rule

On a `rush-consultation` Session the API correctly reports
`payment_method_types: ["card"]` and `payment_method_configuration_details: null`
— so `paymentMethodTypes()` in `src/lib/stripe.ts` is doing its job. **But the
hosted page still offered Bank and Klarna**, both labelled "Powered by Link",
because the account's default configuration has `link`, `klarna`, `affirm`,
`cashapp`, `amazon_pay` and others switched on, and Link surfaces its own funding
options regardless of the Session's `payment_method_types`.

This matters because it defeats a deliberate decision: essays and rush are
card-only precisely because ACH settles in days while the site promises a 72-hour
turnaround starting at payment. Klarna on an education service was never a
decision anyone made.

- [ ] Review Settings → Payments → Payment methods; disable Link and/or Klarna,
      or accept them explicitly.
- [ ] Not yet established: whether a Link bank-funded payment actually settles on
      ACH timing. Only the card path was completed.

### 4.3 The rest

- [ ] Customer emails → successful payments **ON**. Stripe's receipt is the
      invoice PDF customers file and the primary dispute evidence — the welcome
      email is not a receipt and must not replace it.
- [ ] Customer Portal **ON**, allowing payment-method updates and cancellation.
      Copy its login link into `STRIPE_PORTAL_URL`.
- [ ] Near one-click cancellation **ON**.
- [ ] Upcoming renewal emails **ON** — a surprise $2,750 charge with no warning is
      the ARL failure mode.
- [ ] Failed payment emails + Smart Retries **ON**.
- [ ] Stripe Tax **OFF** pending the CPA — see `CONTENT-REVIEW.md` §1.2.

## 5. Code — one open issue

- [ ] **`welcomeEmail` renders a dead "Manage subscription" link when
      `STRIPE_PORTAL_URL` is a placeholder.** `src/lib/email.ts:258` gates the
      block on `details.isSubscription && details.portalUrl` — any non-empty
      string passes, including `…/p/login/replace_me`. A placeholder therefore
      produces a broken link rather than gracefully falling back to the
      "email us to cancel" text. Since that link is the ARL cancellation path,
      it should validate the value rather than merely check it exists.

Fixed during this session, for context:

- `scripts/preflight.mjs` stripped quotes only when a value *ended* with one, but
  every `.dev.vars` value carries a trailing `# $300.00 one-time` comment, so the
  closing quote stayed attached. It reported all five Price IDs as "these look
  like Product IDs" against IDs that were correct. Latent while the values were
  placeholders; it would have fired on the first real deploy.

## 6. Legal and compliance sign-offs

Tracked in `CONTENT-REVIEW.md` — eight items, none of them code. The **copy
itself is signed off** (2026-08-02); these are what survived it.

- [ ] §1.1 ARL / cancellation flow reviewed by counsel; `STRIPE_PORTAL_URL` set
- [ ] §1.2 Stripe Tax question answered by the CPA
- [ ] §1.3 Open-ended vs fixed-cycle subscription confirmed
- [ ] §1.4 Street-address recommendation accepted or revisited
- [ ] §3.1 Subprocessor list confirmed complete
- [ ] §3.3 The rush full-refund sentence confirmed **or removed**
- [ ] §3.4 `RUSH_RESPONSE_HOURS` confirmed as achievable
- [ ] §3.8 Globe institution list and disclaimer approved by counsel

## 7. Worth considering, not blocking

- **Mobile purchase rail sits below the fold.** On a 414px viewport it renders
  after the entire body copy including the full refund policy, so a buyer scrolls
  a long way to reach the button. A sticky mobile buy-bar is the usual answer.
  Design decision, not a defect.
- **Webhook replay across cold isolates.** The dedupe `Set` in
  `src/pages/api/stripe-webhook.ts` only covers a warm isolate; a retry landing
  cold would resend email. Already documented in the README as an accepted
  trade-off — revisit only if duplicates show up in practice.

---

## Sandbox test data

The sandbox holds 5 products/prices, 1 customer (`cus_V06NAAXrWep7l9`), and one
successful $100 payment. `npm run seed:stripe` is safe to re-run — it reuses by
`lookup_key` rather than duplicating, and flags a mismatch if the catalog drifts.
