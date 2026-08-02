import { useState, type FormEvent } from 'react';
import Turnstile from './Turnstile';
import { contactSchema, fieldErrors } from '../lib/schemas';
import FormUnavailable from './FormUnavailable';

type Status = 'idle' | 'pending' | 'success' | 'error';

interface Props {
  turnstileSiteKey: string;
  phone: string;
  phoneHref: string;
}

const EMPTY = { first: '', last: '', email: '', msg: '' };

/**
 * Contact form. The four states and their copy are the prototype's, verbatim.
 * The error state surfaces the phone number, which is the documented fallback
 * whenever a submission cannot get through.
 */
export default function ContactForm({ turnstileSiteKey, phone, phoneHref }: Props) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [resetKey, setResetKey] = useState(0);

  function update(name: keyof typeof EMPTY, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'pending') return;

    // Client-side mirror of the server schema. The server re-validates; this
    // only exists so the user gets feedback without a round trip.
    const parsed = contactSchema.safeParse({ ...values, turnstileToken: token });
    if (!parsed.success) {
      const flat = fieldErrors(parsed.error);
      setErrors(flat);
      // A missing Turnstile token is not a field the user can fix by typing.
      if (flat['turnstileToken']) setStatus('error');
      return;
    }

    setStatus('pending');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setStatus('success');
        setValues(EMPTY);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setToken('');
      setResetKey((n) => n + 1);
    }
  }

  function reset() {
    setStatus('idle');
    setErrors({});
    setResetKey((n) => n + 1);
  }

  // No site key in the build → the server will reject every submission. Say so
  // rather than letting someone type a message into a form that cannot send.
  if (!turnstileSiteKey) {
    return (
      <FormUnavailable
        phone={phone}
        phoneHref={phoneHref}
        email="info@universitynavigator.org"
      />
    );
  }

  if (status === 'pending') {
    return (
      <div className="py-12 text-center" aria-live="polite" role="status">
        <div className="mb-2 font-serif text-[22px] text-maroon">Sending…</div>
        <div className="text-[14px] text-ink-muted">Your message is on its way.</div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="px-3 py-10 text-center" aria-live="polite" role="status">
        <div className="mx-auto mb-4.5 flex h-13 w-13 items-center justify-center rounded-full bg-gold text-[22px] text-maroon-deep">
          ✓
        </div>
        <div className="mb-2.5 font-serif text-[24px] text-maroon">Message sent</div>
        <p className="mx-auto mb-5 text-[15px] leading-[1.6] text-ink-soft">
          Thank you — we'll reply within one business day.
        </p>
        <button type="button" onClick={reset} className="link-rule bg-transparent text-[14px]">
          Send another message
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="px-3 py-10 text-center" aria-live="assertive" role="alert">
        <div className="mx-auto mb-4.5 flex h-13 w-13 items-center justify-center rounded-full bg-maroon-link text-[22px] text-bg">
          !
        </div>
        <div className="mb-2.5 font-serif text-[24px] text-maroon">
          That didn't go through
        </div>
        <p className="mx-auto mb-5 text-[15px] leading-[1.6] text-ink-soft">
          Your message wasn't sent. Please try again — or call us directly at{' '}
          <a href={phoneHref} className="font-semibold">
            {phone}
          </a>
          .
        </p>
        <button type="button" onClick={reset} className="link-rule bg-transparent text-[14px]">
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="contact-first"
          label="First name"
          value={values.first}
          error={errors['first']}
          autoComplete="given-name"
          onChange={(v) => update('first', v)}
        />
        <Field
          id="contact-last"
          label="Last name"
          value={values.last}
          error={errors['last']}
          autoComplete="family-name"
          onChange={(v) => update('last', v)}
        />
        <div className="sm:col-span-2">
          <Field
            id="contact-email"
            label="Email"
            type="email"
            value={values.email}
            error={errors['email']}
            autoComplete="email"
            onChange={(v) => update('email', v)}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="contact-msg" className="field-label">
            Message
          </label>
          <textarea
            id="contact-msg"
            name="msg"
            rows={5}
            required
            value={values.msg}
            onChange={(event) => update('msg', event.target.value)}
            aria-invalid={errors['msg'] ? true : undefined}
            aria-describedby={errors['msg'] ? 'contact-msg-error' : undefined}
            className="field resize-y"
          />
          {errors['msg'] && (
            <p id="contact-msg-error" className="mt-1.5 text-[13px] text-maroon-link">
              {errors['msg']}
            </p>
          )}
        </div>
      </div>

      <Turnstile
        key={resetKey}
        siteKey={turnstileSiteKey}
        onToken={setToken}
        action="turnstile-spin-v2"
      />

      <button type="submit" className="btn-primary mt-5.5 w-full py-4 text-[15px]">
        Send message
      </button>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error?: string | undefined;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}

function Field({ id, label, value, error, type = 'text', autoComplete, onChange }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={id.replace('contact-', '')}
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="field"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-maroon-link">
          {error}
        </p>
      )}
    </div>
  );
}
