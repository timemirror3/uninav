import { useEffect, useRef, useState } from 'react';

interface Props {
  /** cal.com link, e.g. "university-navigator-lb9xx8/30min". */
  calLink: string;
  phone: string;
  phoneHref: string;
  /** Milliseconds to wait for the iframe to load before showing the fallback. */
  timeoutMs?: number;
}

type State = 'loading' | 'ready' | 'failed';

/**
 * cal.com inline embed for the free consultation — the only bookable event type.
 *
 * Deliberately a plain <iframe> rather than @calcom/embed-react.
 *
 * Their embed script (both the imperative `cal('inline', …)` API and the <Cal>
 * component) throws an uncaught "iframe doesn't exist. `createIframe` must be
 * called before `doInIframe`" from inside embed.js on every load here. That
 * error left the React island wedged — it never finished hydrating, so the
 * scheduler sat on "Loading…" forever and even the fallback never fired. An
 * iframe has no such lifecycle to race: it either loads or it doesn't.
 *
 * What we give up is auto-height (the container is a fixed height instead) and
 * script-level theming (passed as URL params). Both are cheap next to a booking
 * page that reliably works.
 *
 * The fallback below is real defensive UI, not scaffolding: privacy extensions
 * block cal.com fairly often. Its copy is the prototype's, verbatim.
 */
export default function CalEmbed({ calLink, phone, phoneHref, timeoutMs = 10000 }: Props) {
  const [state, setState] = useState<State>('loading');
  const wrapRef = useRef<HTMLDivElement>(null);

  const bookingUrl = `https://cal.com/${calLink}`;
  /*
   * Point at the canonical /embed path rather than `?embed=true` on the booking
   * page: the latter 302s to app.cal.com and drops the query string on the way,
   * which silently lost `theme=light` and rendered a dark scheduler on a cream
   * page. Theming rides on the URL since there is no script to configure.
   */
  const embedUrl = `${bookingUrl}/embed?theme=light&layout=month_view&brandColor=%23560F10`;

  /*
   * No internal IntersectionObserver.
   *
   * There used to be one gating `visible`, on top of Astro's own client:*
   * deferral. It never fired in production — the island hydrated, `visible`
   * stayed false, the iframe was never rendered, and /book sat on "Loading the
   * scheduler…" forever with no fallback. Two lazy gates in series is one too
   * many; the iframe's own loading="lazy" is enough.
   */
  // If it never loads, show the fallback rather than an endless spinner.
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setState((s) => (s === 'loading' ? 'failed' : s)), timeoutMs);
    return () => clearTimeout(timer);
  }, [state, timeoutMs]);

  if (!calLink || state === 'failed') {
    return (
      <div
        className="rounded-[6px] border border-[rgba(86,15,16,.2)] bg-[rgba(240,223,180,.2)] px-6 py-12 text-center sm:px-12 sm:py-14"
        role="status"
      >
        <h3 className="mb-3 font-serif text-[clamp(21px,4vw,26px)] text-maroon">
          The scheduler didn't load
        </h3>
        <p className="mx-auto mb-6 max-w-[44ch] text-[15px] leading-[1.6] text-ink-soft">
          You can book directly on our scheduling page, or call us and we'll find a time
          together.
        </p>
        <div className="flex flex-wrap justify-center gap-3.5">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener"
          className="btn-primary px-6 py-3.5 text-[14px]"
          >
            Open our booking page ↗
          </a>
          <a href={phoneHref} className="btn-outline px-6 py-3.5 text-[14px]">
            {phone}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[6px] border border-rule bg-white">
      <div className="flex items-center justify-between border-b border-[rgba(86,15,16,.1)] px-5 py-3.5">
        <span className="eyebrow">Free consultation — 30 min</span>
        <a href={bookingUrl} target="_blank" rel="noopener" className="text-[13px]">
          Open in a new tab ↗
        </a>
      </div>

      <div ref={wrapRef} className="relative h-[680px] w-full sm:h-[760px]">
        {state === 'loading' && (
          <p className="absolute inset-0 flex items-center justify-center text-[14px] text-ink-muted">
            Loading the scheduler…
          </p>
        )}
        <iframe
          src={embedUrl}
          title="Book a free consultation with University Navigator"
          className="h-full w-full border-0"
          loading="lazy"
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
          // Only what the booking flow needs.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
