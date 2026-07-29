interface Props {
  phone: string;
  phoneHref: string;
  email: string;
  /** 'panel' for the page forms, 'inline' for the footer newsletter. */
  variant?: 'panel' | 'inline';
}

/**
 * Shown in place of a form when PUBLIC_TURNSTILE_SITE_KEY is missing from the
 * build.
 *
 * Without a site key the widget never renders, no token is produced, and the
 * server — which fails closed, correctly — rejects every submission with 403.
 * The form looks perfectly healthy right up until someone finishes filling it in
 * and loses their work.
 *
 * So say so, and give them a route that actually reaches the office. This is a
 * misconfiguration, not something the visitor did.
 */
export default function FormUnavailable({
  phone,
  phoneHref,
  email,
  variant = 'panel',
}: Props) {
  if (variant === 'inline') {
    return (
      <p className="text-[14px] leading-[1.6] text-cream-muted">
        Signup is temporarily unavailable. Email{' '}
        <a href={`mailto:${email}`} className="text-cream underline">
          {email}
        </a>{' '}
        to be added.
      </p>
    );
  }

  return (
    <div
      className="rounded-[4px] border border-[rgba(86,15,16,.2)] bg-[rgba(240,223,180,.25)] px-5 py-6 text-center"
      role="status"
    >
      <p className="mb-2 font-serif text-[20px] text-maroon">
        This form is temporarily unavailable
      </p>
      <p className="mx-auto mb-4 max-w-[44ch] text-[15px] leading-[1.6] text-ink-soft">
        We're sorry — please reach us directly and we'll respond just as quickly.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[15px] font-semibold">
        <a href={phoneHref}>{phone}</a>
        <a href={`mailto:${email}`}>{email}</a>
      </div>
    </div>
  );
}
