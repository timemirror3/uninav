import { useEffect, useRef, useState } from 'react';
import Turnstile from './Turnstile';
import { INQUIRY_STEP_SCHEMAS, fieldErrors, inquirySchema } from '../lib/schemas';
import FormUnavailable from './FormUnavailable';

type Status = 'idle' | 'pending' | 'success' | 'error';

interface Props {
  turnstileSiteKey: string;
  phone: string;
  phoneHref: string;
}

const STEP_NAMES = ['About you', 'Contact', 'Academic', 'Interests'] as const;

const STORAGE_KEY = 'uni-inquiry-draft';

type Values = Record<string, string>;

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  birthdate: '',
  firstGen: '',
  military: '',
  email: '',
  phone: '',
  addr1: '',
  addr2: '',
  city: '',
  state: '',
  zip: '',
  institution: '',
  ceeb: '',
  applyingAs: '',
  entryTerm: '',
  interest1: '',
  interest2: '',
  interest3: '',
};

/**
 * Four-step Request for Information.
 *
 * Answers persist across step navigation and across reload. sessionStorage is
 * used rather than localStorage so the draft dies with the tab — this form
 * collects birthdates and addresses, frequently a minor's, and leaving that on
 * disk indefinitely is not something the privacy policy promises. The privacy
 * policy names this storage explicitly.
 */
export default function InquiryForm({ turnstileSiteKey, phone, phoneHref }: Props) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [resetKey, setResetKey] = useState(0);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore a draft on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          values?: Values;
          consent?: boolean;
          step?: number;
        };
        if (saved.values) setValues({ ...EMPTY, ...saved.values });
        if (typeof saved.consent === 'boolean') setConsent(saved.consent);
        if (saved.step && saved.step >= 1 && saved.step <= 4) setStep(saved.step);
      }
    } catch {
      /* storage unavailable or corrupt draft — start clean */
    }
    setRestored(true);
  }, []);

  // Persist on change, but only after the restore pass so we never overwrite a
  // saved draft with the empty initial state.
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ values, consent, step }));
    } catch {
      /* quota or private mode — persistence is best-effort */
    }
  }, [values, consent, step, restored]);

  function update(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function focusHeading() {
    // Move focus to the step heading so screen-reader users are told where they
    // landed, instead of being silently left at the bottom of the form.
    requestAnimationFrame(() => headingRef.current?.focus());
    window.scrollTo({ top: 0 });
  }

  function next() {
    const schema = INQUIRY_STEP_SCHEMAS[step - 1];
    const parsed = schema?.safeParse(values);
    if (parsed && !parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setStep((n) => Math.min(4, n + 1));
    focusHeading();
  }

  function back() {
    setErrors({});
    setStep((n) => Math.max(1, n - 1));
    focusHeading();
  }

  async function submit() {
    if (status === 'pending') return;

    const parsed = inquirySchema.safeParse({ ...values, consent, turnstileToken: token });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setStatus('pending');
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setStatus('success');
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* nothing to clear */
        }
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setToken('');
      setResetKey((n) => n + 1);
      window.scrollTo({ top: 0 });
    }
  }

  if (!turnstileSiteKey) {
    return (
      <FormUnavailable
        phone={phone}
        phoneHref={phoneHref}
        email="info@universitynavigator.org"
      />
    );
  }

  if (status === 'success') {
    return (
      <div className="card px-6 py-14 text-center sm:px-10" aria-live="polite" role="status">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[24px] text-maroon-deep">
          ✓
        </div>
        <h2 className="mb-3 font-serif text-[28px] text-maroon">Inquiry received</h2>
        <p className="mx-auto mb-6 max-w-[46ch] text-[15px] leading-[1.65] text-ink-soft">
          Thank you — we'll review your information and reply within one business day. If
          anything is time-sensitive, call us at{' '}
          <a href={phoneHref} className="font-semibold">
            {phone}
          </a>
          .
        </p>
        <a href="/book" className="btn-primary px-[26px] py-3.5 text-[14px]">
          Book your free consultation
        </a>
      </div>
    );
  }

  return (
    <>
      {/* ------------------------- PROGRESS ------------------------- */}
      <ol
        className="mb-10 flex list-none items-start p-0"
        aria-label={`Step ${step} of 4`}
      >
        {STEP_NAMES.map((name, index) => {
          const n = index + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={name} className="flex flex-1 items-center">
              <div className="flex min-w-[52px] flex-col items-center gap-2 sm:min-w-[90px]">
                <span
                  aria-hidden="true"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
                  style={{
                    font: "600 11px 'Public Sans'",
                    background: active ? '#560F10' : done ? '#D8A13A' : '#FAF7F1',
                    color: active ? '#FAF7F1' : done ? '#38090D' : '#8A6420',
                    border: active || done ? 'none' : '1.5px solid #D8A13A',
                  }}
                >
                  {done ? '✓' : String(n).padStart(2, '0')}
                </span>
                <span
                  className="text-center"
                  style={{
                    font: "600 10px 'Public Sans'",
                    letterSpacing: '.12em',
                    color: active ? '#560F10' : '#6B6763',
                  }}
                >
                  {name.toUpperCase()}
                </span>
              </div>
              {n < 4 && (
                <div
                  aria-hidden="true"
                  className="mx-1.5 mb-6 h-0 flex-1 border-t-[1.5px] border-dashed border-gold"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="card p-6 sm:p-9">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-5.5 font-serif text-[24px] text-maroon outline-none"
        >
          {step === 1 && 'About you'}
          {step === 2 && 'Contact'}
          {step === 3 && 'Academic background'}
          {step === 4 && 'Academic interests'}
        </h2>

        {/* --------------------------- STEP 1 --------------------------- */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
            <Text id="firstName" label="First name" values={values} errors={errors} onChange={update} autoComplete="given-name" />
            <Text id="lastName" label="Last name" values={values} errors={errors} onChange={update} autoComplete="family-name" />
            <Text id="birthdate" label="Birthdate" type="date" values={values} errors={errors} onChange={update} optional />
            <div className="hidden sm:block" />
            <Radio
              name="firstGen"
              legend="First-generation college student?"
              value={values['firstGen'] ?? ''}
              onChange={update}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
            <Radio
              name="military"
              legend="U.S. military status?"
              value={values['military'] ?? ''}
              onChange={update}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
          </div>
        )}

        {/* --------------------------- STEP 2 --------------------------- */}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
            <Text id="email" label="Email" type="email" values={values} errors={errors} onChange={update} autoComplete="email" />
            <Text id="phone" label="Phone" type="tel" values={values} errors={errors} onChange={update} autoComplete="tel" optional />
            <div className="sm:col-span-2">
              <Text id="addr1" label="Address line 1" values={values} errors={errors} onChange={update} autoComplete="address-line1" optional />
            </div>
            <div className="sm:col-span-2">
              <Text id="addr2" label="Address line 2" values={values} errors={errors} onChange={update} autoComplete="address-line2" optional />
            </div>
            <Text id="city" label="City" values={values} errors={errors} onChange={update} autoComplete="address-level2" />
            <div className="grid grid-cols-2 gap-4.5">
              <Text id="state" label="State" values={values} errors={errors} onChange={update} autoComplete="address-level1" />
              <Text id="zip" label="ZIP" values={values} errors={errors} onChange={update} autoComplete="postal-code" />
            </div>
          </div>
        )}

        {/* --------------------------- STEP 3 --------------------------- */}
        {step === 3 && (
          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Text id="institution" label="Current or last institution" values={values} errors={errors} onChange={update} />
            </div>
            <div className="sm:col-span-2">
              <Text
                id="ceeb"
                label="CEEB code"
                values={values}
                errors={errors}
                onChange={update}
                optional
                hint="The CEEB code is a 6-digit College Board identifier for your high school — your counselor will know it."
              />
            </div>
            <Radio
              name="applyingAs"
              legend="Applying as"
              value={values['applyingAs'] ?? ''}
              onChange={update}
              options={[
                { value: 'first-year', label: 'First-year' },
                { value: 'transfer', label: 'Transfer' },
              ]}
            />
            <div>
              <label htmlFor="entryTerm" className="field-label">
                Entry term
              </label>
              <select
                id="entryTerm"
                name="entryTerm"
                value={values['entryTerm'] ?? ''}
                onChange={(event) => update('entryTerm', event.target.value)}
                className="field"
              >
                <option value="">Select…</option>
                <option value="Fall 2026">Fall 2026</option>
                <option value="Fall 2027">Fall 2027</option>
                <option value="Fall 2028">Fall 2028</option>
                <option value="Fall 2029">Fall 2029</option>
              </select>
            </div>
          </div>
        )}

        {/* --------------------------- STEP 4 --------------------------- */}
        {step === 4 && (
          <div className="flex flex-col gap-4.5">
            <Text id="interest1" label="First academic interest" values={values} errors={errors} onChange={update} />
            <Text id="interest2" label="Second academic interest" values={values} errors={errors} onChange={update} optional />
            <Text id="interest3" label="Third academic interest" values={values} errors={errors} onChange={update} optional />

            {/* Unchecked by default and separate from the inquiry itself. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-[4px] border border-[rgba(86,15,16,.18)] bg-[rgba(240,223,180,.2)] p-3.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#560F10]"
              />
              <span className="text-[13px] leading-[1.55]">
                I'd like to receive occasional admissions guidance by email. Optional —
                unchecked by default, and separate from this inquiry.
              </span>
            </label>

            <Turnstile
              key={resetKey}
              siteKey={turnstileSiteKey}
              onToken={setToken}
              action="turnstile-spin-v2"
            />
          </div>
        )}

        {/* --------------------------- CONTROLS --------------------------- */}
        <div className="mt-7 flex items-center justify-between gap-3 border-t border-[rgba(86,15,16,.12)] pt-5.5">
          {step > 1 ? (
            <button type="button" onClick={back} className="btn-outline px-[22px] py-3.5 text-[14px]">
              ← Back
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-4">
            <a href="/policies/privacy" className="text-[13px]">
              Privacy policy
            </a>
            {step < 4 ? (
              <button type="button" onClick={next} className="btn-primary px-[26px] py-3.5 text-[14px]">
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={status === 'pending'}
                className="btn-gold px-[26px] py-3.5 text-[14px] disabled:opacity-70"
              >
                {status === 'pending' ? 'Submitting…' : 'Submit inquiry'}
              </button>
            )}
          </div>
        </div>

        <div aria-live="assertive" role={status === 'error' ? 'alert' : undefined}>
          {status === 'error' && (
            <p className="mt-4 rounded-[4px] border border-[rgba(138,27,38,.35)] bg-[rgba(138,27,38,.06)] px-4 py-3 text-[14px] leading-[1.6] text-maroon">
              Your inquiry wasn't sent. Please try again — or call us directly at{' '}
              <a href={phoneHref} className="font-semibold">
                {phone}
              </a>
              . Your answers have been kept.
            </p>
          )}
          {Object.keys(errors).length > 0 && status !== 'error' && (
            <p className="mt-4 text-[14px] text-maroon-link">
              Please check the highlighted fields above.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-[12px] text-ink-muted">
        Your answers persist if you navigate back — nothing is wiped. Sent by email only;
        never stored with a third-party form service.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */

interface TextProps {
  id: string;
  label: string;
  values: Values;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
  type?: string;
  optional?: boolean;
  hint?: string;
  autoComplete?: string;
}

function Text({
  id,
  label,
  values,
  errors,
  onChange,
  type = 'text',
  optional = false,
  hint,
  autoComplete,
}: TextProps) {
  const error = errors[id];
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && (
          <em className="font-normal text-ink-muted"> (optional)</em>
        )}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={values[id] ?? ''}
        autoComplete={autoComplete}
        onChange={(event) => onChange(id, event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-maroon-link">
          {error}
        </p>
      )}
    </div>
  );
}

interface RadioProps {
  name: string;
  legend: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: Array<{ value: string; label: string }>;
}

function Radio({ name, legend, value, onChange, options }: RadioProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="field-label p-0">{legend}</legend>
      <div className="mt-2 flex gap-2.5">
        {options.map((option) => {
          const on = value === option.value;
          return (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-[4px] px-4 py-2.5 text-[14px] font-medium text-maroon"
              style={{
                border: on ? '1px solid #D8A13A' : '1px solid rgba(86,15,16,.25)',
                background: on ? 'rgba(240,223,180,.35)' : '#FAF7F1',
              }}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={on}
                onChange={() => onChange(name, option.value)}
                className="accent-[#560F10]"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
