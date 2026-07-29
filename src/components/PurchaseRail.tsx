import { useState } from 'react';

interface Props {
  slug: string;
  price: string;
  term: string;
  billingNote: string;
  cta: string;
  refundAckText: string;
}

/**
 * Sticky purchase rail with the refund-policy acknowledgement gate.
 *
 * The gate is deliberately a plain form POST to /api/checkout rather than a
 * fetch: the endpoint answers with a 303 to Stripe Checkout, so the browser
 * follows it natively. That also means the whole flow still works if the island
 * fails to hydrate — the checkbox's `required` attribute enforces the gate
 * server-side-of-the-browser, and the server re-validates regardless.
 *
 * `refundAckAt` is stamped the moment the box is ticked and travels into the
 * Checkout Session metadata. This is chargeback evidence, so it has to be a real
 * recorded timestamp rather than something reconstructed later.
 */
export default function PurchaseRail({
  slug,
  price,
  term,
  billingNote,
  cta,
  refundAckText,
}: Props) {
  const [acked, setAcked] = useState(false);
  const [ackedAt, setAckedAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function onToggle(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.checked;
    setAcked(next);
    setAckedAt(next ? new Date().toISOString() : '');
  }

  return (
    <form
      method="post"
      action="/api/checkout"
      onSubmit={() => setSubmitting(true)}
      className="card p-8"
    >
      <input type="hidden" name="product" value={slug} />
      <input type="hidden" name="refundAckAt" value={ackedAt} />

      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
        <span className="font-serif text-[38px] text-maroon">{price}</span>
        <span className="text-[13px] text-ink-muted">{term}</span>
      </div>
      <div className="mb-6 text-[13px] text-ink-muted">{billingNote}</div>

      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-[4px] border border-[rgba(86,15,16,.18)] bg-[rgba(240,223,180,.2)] p-4">
        <input
          type="checkbox"
          name="refundAck"
          value="true"
          required
          checked={acked}
          onChange={onToggle}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#560F10]"
        />
        <span className="text-[14px] leading-[1.55]">
          I have read and accept the{' '}
          <a href="/policies/refunds" target="_blank" rel="noopener">
            refund policy
          </a>
          , including that no refunds are issued after 7 days of purchase or once any
          work or consultations have taken place.
        </span>
      </label>

      <button
        type="submit"
        disabled={!acked || submitting}
        className="btn-primary w-full py-4 text-[15px]"
      >
        {submitting ? 'Redirecting to Stripe…' : acked ? cta : 'Accept the refund policy to continue'}
      </button>

      {/* Announce the gate's state rather than relying on the disabled styling. */}
      <p aria-live="polite" className="sr-only">
        {acked
          ? 'Refund policy accepted. You can continue to checkout.'
          : 'Accept the refund policy to continue.'}
      </p>

      <a
        href="/book"
        className="btn-outline mt-3 block w-full py-3.5 text-[14px]"
      >
        Not sure? Book a free consultation
      </a>

      <p className="mt-5 text-[12px] leading-[1.6] text-ink-muted">
        Secure payment via Stripe Checkout. You'll acknowledge the refund policy before
        paying. Admission to any college or university cannot be guaranteed.
      </p>

      <span className="sr-only">{refundAckText}</span>
    </form>
  );
}
