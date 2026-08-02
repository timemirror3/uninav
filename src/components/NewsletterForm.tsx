import { useState, type FormEvent } from 'react';
import Turnstile from './Turnstile';
import { newsletterSchema } from '../lib/schemas';
import FormUnavailable from './FormUnavailable';

type Status = 'idle' | 'pending' | 'success' | 'error';

interface Props {
  turnstileSiteKey: string;
}

/**
 * Footer newsletter form.
 *
 * States and copy are the prototype's, verbatim:
 *   pending → "Subscribing…"
 *   success → "✓ Subscribed — welcome aboard."
 *   error   → "That didn't go through — try again or email us directly."
 */
export default function NewsletterForm({ turnstileSiteKey }: Props) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [resetKey, setResetKey] = useState(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'pending') return;

    const parsed = newsletterSchema.safeParse({ email, turnstileToken: token });
    if (!parsed.success) {
      setStatus('error');
      return;
    }

    setStatus('pending');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setStatus(response.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    } finally {
      // Turnstile tokens are single-use; force a fresh widget either way.
      setToken('');
      setResetKey((n) => n + 1);
    }
  }

  if (!turnstileSiteKey) {
    return (
      <FormUnavailable
        variant="inline"
        phone="(424) 404-3686"
        phoneHref="tel:+14244043686"
        email="info@universitynavigator.org"
      />
    );
  }

  return (
    <div>
      {status === 'idle' || status === 'error' ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="min-w-0 flex-1 rounded-[4px] border border-[rgba(216,161,58,.4)] bg-[rgba(250,247,241,.06)] px-3 py-[11px] text-[14px] text-bg placeholder:text-cream-muted"
            />
            <button
              type="submit"
              className="btn-gold shrink-0 px-[18px] text-[13px]"
            >
              Subscribe
            </button>
          </div>
          <Turnstile
            key={resetKey}
            siteKey={turnstileSiteKey}
            onToken={setToken}
            theme="dark"
            action="turnstile-spin-v2"
          />
        </form>
      ) : null}

      {/* Status is announced to assistive tech without stealing focus. */}
      <div aria-live="polite" role="status">
        {status === 'pending' && (
          <div className="text-[14px] text-cream">Subscribing…</div>
        )}
        {status === 'success' && (
          <div className="text-[14px] text-gold">✓ Subscribed — welcome aboard.</div>
        )}
        {status === 'error' && (
          <div className="mt-2 text-[14px] text-[#E8B48A]">
            That didn't go through — try again or email us directly.
          </div>
        )}
      </div>
    </div>
  );
}
