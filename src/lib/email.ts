import { Resend } from 'resend';
import type { Env } from './env';
import { REFUND_POLICY, SITE } from './site';

const DEFAULT_FROM = `University Navigator, Inc. <info@universitynavigator.org>`;

export function fromAddress(env: Env): string {
  return env.FROM_EMAIL ?? DEFAULT_FROM;
}

export function internalInbox(env: Env): string {
  return env.INTERNAL_NOTIFY_EMAIL ?? SITE.email;
}

/* -------------------------------------------------------------------------- */
/* HTML helpers                                                                */
/* -------------------------------------------------------------------------- */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Shared shell so every message carries the brand and the legal disclaimer. */
function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#FAF7F1;font-family:'Public Sans',Helvetica,Arial,sans-serif;color:#2E2B29">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F1;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid rgba(86,15,16,.14);border-radius:6px">
        <tr><td style="background:#560F10;padding:24px 32px;border-radius:6px 6px 0 0">
          <div style="font-family:Georgia,serif;font-size:20px;color:#FAF7F1">${escapeHtml(SITE.name)}</div>
          <div style="font-size:12px;color:#D8A13A;letter-spacing:.14em;text-transform:uppercase;margin-top:4px">${escapeHtml(SITE.region)}</div>
        </td></tr>
        <tr><td style="padding:32px">${body}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(86,15,16,.14);font-size:12px;line-height:1.6;color:#6B6763">
          ${escapeHtml(SITE.name)} · <a href="mailto:${SITE.email}" style="color:#560F10">${SITE.email}</a> · ${escapeHtml(SITE.phone)}<br>
          Admission to any college or university cannot be guaranteed.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * The refund policy, rendered verbatim and itemized.
 *
 * This appears in every purchase confirmation deliberately: restating the terms
 * alongside the receipt is what makes the acknowledgement defensible if the
 * charge is later disputed.
 */
function refundPolicyHtml(): string {
  return `
    <h2 style="font-family:Georgia,serif;font-size:18px;color:#560F10;margin:28px 0 8px">Refund policy</h2>
    <p style="font-size:14px;line-height:1.65;margin:0 0 10px">${escapeHtml(REFUND_POLICY.intro)}</p>
    <ul style="font-size:14px;line-height:1.65;margin:0;padding-left:20px">
      ${REFUND_POLICY.terms.map((term) => `<li style="margin-bottom:6px">${escapeHtml(term)}</li>`).join('')}
    </ul>`;
}

function refundPolicyText(): string {
  return `Refund policy\n${REFUND_POLICY.intro}\n${REFUND_POLICY.terms.map((t) => `  - ${t}`).join('\n')}`;
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                     */
/* -------------------------------------------------------------------------- */

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Send via Resend. Returns success rather than throwing so callers (notably the
 * Stripe webhook) can decide their own failure semantics — a webhook that throws
 * gets retried, which for an already-recorded payment means duplicate email.
 */
export async function sendEmail(
  env: Env,
  args: SendArgs
): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' };
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: fromAddress(env),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'send failed' };
  }
}

/* -------------------------------------------------------------------------- */
/* Templates — form notifications                                              */
/* -------------------------------------------------------------------------- */

export function contactNotification(input: {
  first: string;
  last: string;
  email: string;
  msg: string;
}) {
  const name = `${input.first} ${input.last}`.trim();
  const rows = [
    ['Name', name],
    ['Email', input.email],
  ];

  return {
    subject: `Contact form — ${name}`,
    html: shell(
      'New contact message',
      `<h1 style="font-family:Georgia,serif;font-size:22px;color:#560F10;margin:0 0 16px">New contact message</h1>
       ${detailTable(rows)}
       <h2 style="font-family:Georgia,serif;font-size:16px;color:#560F10;margin:24px 0 8px">Message</h2>
       <div style="font-size:15px;line-height:1.65;white-space:pre-wrap">${escapeHtml(input.msg)}</div>`
    ),
    text: `New contact message\n\nName: ${name}\nEmail: ${input.email}\n\nMessage:\n${input.msg}`,
  };
}

export function newsletterNotification(email: string) {
  return {
    subject: `Newsletter signup — ${email}`,
    html: shell(
      'New newsletter subscriber',
      `<h1 style="font-family:Georgia,serif;font-size:22px;color:#560F10;margin:0 0 16px">New newsletter subscriber</h1>
       ${detailTable([['Email', email]])}
       <p style="font-size:13px;line-height:1.6;color:#6B6763;margin:20px 0 0">
         This person opted in to occasional admissions guidance by email. Add them to
         your mailing list and honour any unsubscribe request.
       </p>`
    ),
    text: `New newsletter subscriber\n\nEmail: ${email}`,
  };
}

const INQUIRY_LABELS: Array<[string, string]> = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['birthdate', 'Birthdate'],
  ['firstGen', 'First-generation'],
  ['military', 'U.S. military status'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['addr1', 'Address line 1'],
  ['addr2', 'Address line 2'],
  ['city', 'City'],
  ['state', 'State'],
  ['zip', 'ZIP'],
  ['institution', 'Institution'],
  ['ceeb', 'CEEB code'],
  ['applyingAs', 'Applying as'],
  ['entryTerm', 'Entry term'],
  ['interest1', 'First academic interest'],
  ['interest2', 'Second academic interest'],
  ['interest3', 'Third academic interest'],
];

export function inquiryNotification(input: Record<string, unknown>) {
  const name = `${input['firstName'] ?? ''} ${input['lastName'] ?? ''}`.trim();
  const rows = INQUIRY_LABELS.map(([key, label]) => [label, String(input[key] ?? '')])
    .filter(([, value]) => value !== '') as Array<[string, string]>;

  const consent = input['consent'] === true;

  return {
    subject: `Request for Information — ${name || 'new inquiry'}`,
    html: shell(
      'New Request for Information',
      `<h1 style="font-family:Georgia,serif;font-size:22px;color:#560F10;margin:0 0 16px">New Request for Information</h1>
       ${detailTable(rows)}
       <p style="font-size:14px;line-height:1.65;margin:20px 0 0;padding:12px 14px;background:${consent ? 'rgba(240,223,180,.35)' : '#FAF7F1'};border:1px solid rgba(86,15,16,.14);border-radius:4px">
         <strong>Newsletter opt-in:</strong> ${consent ? 'Yes — add to the mailing list.' : 'No.'}
       </p>
       <p style="font-size:13px;line-height:1.6;color:#6B6763;margin:20px 0 0">
         This submission may describe a minor. Handle and store it accordingly.
       </p>`
    ),
    text:
      `New Request for Information\n\n` +
      rows.map(([label, value]) => `${label}: ${value}`).join('\n') +
      `\n\nNewsletter opt-in: ${consent ? 'Yes' : 'No'}`,
  };
}

function detailTable(rows: Array<[string, string]> | string[][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:1.6">
    ${rows
      .map(
        ([label, value]) => `<tr>
          <td style="padding:6px 12px 6px 0;color:#6B6763;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#2E2B29">${escapeHtml(value)}</td>
        </tr>`
      )
      .join('')}
  </table>`;
}

/* -------------------------------------------------------------------------- */
/* Templates — purchase                                                        */
/* -------------------------------------------------------------------------- */

export interface PurchaseDetails {
  productName: string;
  productDesc: string;
  amount: string;
  customerName: string;
  customerEmail: string;
  isSubscription: boolean;
  isRush: boolean;
  rushResponseHours: number;
  acknowledgedAt: string;
  portalUrl?: string | undefined;
}

/**
 * The welcome email.
 *
 * Deliberately separate from Stripe's own receipt. Stripe's receipt is proof of
 * payment and carries the invoice PDF; it cannot contain policy or onboarding
 * copy. This one carries the refund policy verbatim, what happens next, and how
 * to submit drafts. Both are needed; neither replaces the other.
 */
export function welcomeEmail(details: PurchaseDetails) {
  const nextSteps = details.isRush
    ? [
        `Because this is a rush request, the office will email you within ${details.rushResponseHours} hours to schedule your consultation.`,
        `Questions in the meantime? Call ${SITE.phone}.`,
      ]
    : [
        `We'll email you within one business day to schedule your first session.`,
        `Essay drafts can be emailed any time to ${SITE.email} — 72-hour turnaround.`,
        `Questions? Call ${SITE.phone}.`,
      ];

  const portalBlock =
    details.isSubscription && details.portalUrl
      ? `<p style="font-size:14px;line-height:1.65;margin:20px 0 0;padding:14px;background:#FAF7F1;border:1px solid rgba(86,15,16,.14);border-radius:4px">
           <strong>Managing your subscription.</strong> The University Counseling Bundle
           renews every three months until cancelled. You can update your payment method
           or cancel at any time before renewal here:
           <a href="${escapeHtml(details.portalUrl)}" style="color:#560F10">Manage subscription</a>.
         </p>`
      : details.isSubscription
        ? `<p style="font-size:14px;line-height:1.65;margin:20px 0 0;padding:14px;background:#FAF7F1;border:1px solid rgba(86,15,16,.14);border-radius:4px">
             <strong>Managing your subscription.</strong> The University Counseling Bundle
             renews every three months until cancelled. To update your payment method or
             cancel before renewal, reply to this email or contact
             <a href="mailto:${SITE.email}" style="color:#560F10">${SITE.email}</a>.
           </p>`
        : '';

  return {
    subject: details.isRush
      ? `Rush consultation confirmed — ${SITE.name}`
      : `Welcome to ${SITE.name}`,
    html: shell(
      'Payment confirmed',
      `<h1 style="font-family:Georgia,serif;font-size:24px;color:#560F10;margin:0 0 12px">Payment confirmed</h1>
       <p style="font-size:15px;line-height:1.65;margin:0 0 20px">
         Thank you${details.customerName ? `, ${escapeHtml(details.customerName)}` : ''} — your engagement with
         ${escapeHtml(SITE.name)} is confirmed. Stripe has emailed your receipt separately.
       </p>
       ${detailTable([
         ['Service', details.productName],
         ['Amount', details.amount],
         ['Billing', details.isSubscription ? 'Renews every 3 months until cancelled' : 'One-time charge'],
       ])}
       <h2 style="font-family:Georgia,serif;font-size:18px;color:#560F10;margin:28px 0 8px">What happens next</h2>
       <ol style="font-size:15px;line-height:1.65;margin:0;padding-left:20px">
         ${nextSteps.map((step) => `<li style="margin-bottom:8px">${escapeHtml(step)}</li>`).join('')}
       </ol>
       ${portalBlock}
       ${refundPolicyHtml()}
       <p style="font-size:12px;line-height:1.6;color:#6B6763;margin:20px 0 0">
         You accepted this refund policy at checkout on ${escapeHtml(details.acknowledgedAt)}.
       </p>`
    ),
    text: [
      `Payment confirmed`,
      ``,
      `Thank you${details.customerName ? `, ${details.customerName}` : ''} — your engagement with ${SITE.name} is confirmed.`,
      `Stripe has emailed your receipt separately.`,
      ``,
      `Service: ${details.productName}`,
      `Amount: ${details.amount}`,
      `Billing: ${details.isSubscription ? 'Renews every 3 months until cancelled' : 'One-time charge'}`,
      ``,
      `What happens next`,
      ...nextSteps.map((step, index) => `  ${index + 1}. ${step}`),
      ``,
      refundPolicyText(),
      ``,
      `You accepted this refund policy at checkout on ${details.acknowledgedAt}.`,
    ].join('\n'),
  };
}

/**
 * Internal purchase notification.
 *
 * This is the entire technical handoff to the person who does the scheduling, so
 * it has to carry everything they need to act. Rush is marked urgent in the
 * subject because it carries a response clock the others do not.
 */
export function internalPurchaseNotification(details: PurchaseDetails) {
  const subject = details.isRush
    ? `[URGENT — ${details.rushResponseHours}h] Rush consultation purchased — ${details.customerName || details.customerEmail}`
    : `New purchase — ${details.productName} — ${details.customerName || details.customerEmail}`;

  const action = details.isRush
    ? `Email this family within ${details.rushResponseHours} hours to schedule. They paid a premium for speed.`
    : `Email this client within one business day to schedule their first session.`;

  return {
    subject,
    html: shell(
      subject,
      `<h1 style="font-family:Georgia,serif;font-size:22px;color:#560F10;margin:0 0 16px">
         ${details.isRush ? 'Rush consultation purchased' : 'New purchase'}
       </h1>
       <p style="font-size:15px;line-height:1.65;margin:0 0 20px;padding:14px;background:${details.isRush ? 'rgba(216,161,58,.25)' : '#FAF7F1'};border:1px solid ${details.isRush ? '#D8A13A' : 'rgba(86,15,16,.14)'};border-radius:4px">
         <strong>Action:</strong> ${escapeHtml(action)}
       </p>
       ${detailTable([
         ['Product', details.productName],
         ['Amount', details.amount],
         ['Customer', details.customerName || '—'],
         ['Email', details.customerEmail],
         ['Billing', details.isSubscription ? 'Subscription — renews quarterly' : 'One-time'],
         ['Refund policy accepted', details.acknowledgedAt],
       ])}`
    ),
    text: [
      details.isRush ? `RUSH CONSULTATION PURCHASED` : `New purchase`,
      ``,
      `Action: ${action}`,
      ``,
      `Product: ${details.productName}`,
      `Amount: ${details.amount}`,
      `Customer: ${details.customerName || '—'}`,
      `Email: ${details.customerEmail}`,
      `Billing: ${details.isSubscription ? 'Subscription — renews quarterly' : 'One-time'}`,
      `Refund policy accepted: ${details.acknowledgedAt}`,
    ].join('\n'),
  };
}
