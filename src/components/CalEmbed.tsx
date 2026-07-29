import { useEffect, useRef, useState } from 'react';

interface Props {
  /** cal.com link, e.g. "universitynavigator/free-consultation". */
  calLink: string;
  phone: string;
  phoneHref: string;
  /** Milliseconds before the fallback replaces the embed. */
  timeoutMs?: number;
}

type State = 'loading' | 'ready' | 'failed';

/**
 * cal.com inline embed for the free consultation — the only bookable event type.
 *
 * The fallback below is real defensive UI, not prototype scaffolding: if the
 * embed script is blocked (privacy extensions block cal.com fairly often), fails
 * to load, or simply never renders, the visitor still gets a working path to a
 * booking. The prototype's fallback copy is preserved verbatim.
 *
 * The embed script is loaded lazily on first intersection so it costs nothing on
 * routes that never scroll to it.
 */
export default function CalEmbed({
  calLink,
  phone,
  phoneHref,
  timeoutMs = 8000,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('loading');
  const [visible, setVisible] = useState(false);

  const bookingUrl = `https://cal.com/${calLink}`;

  // Only start loading once the embed is close to the viewport.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !calLink) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function mount() {
      try {
        const { getCalApi } = await import('@calcom/embed-react');
        const cal = await getCalApi();
        if (cancelled) return;

        cal('ui', {
          theme: 'light',
          cssVarsPerTheme: {
            light: {
              'cal-brand': '#560F10',
              'cal-text': '#2E2B29',
              'cal-text-emphasis': '#560F10',
              'cal-bg': '#ffffff',
              'cal-bg-emphasis': '#F0DFB4',
              'cal-border': 'rgba(86,15,16,.20)',
              'cal-border-emphasis': '#D8A13A',
            },
            dark: {},
          },
          hideEventTypeDetails: false,
          layout: 'month_view',
        });

        cal('inline', {
          elementOrSelector: '#cal-inline',
          calLink,
          config: { layout: 'month_view' },
        });

        // The API resolving does not guarantee the iframe painted. Treat "no
        // iframe inside the container" as a failure once the timeout elapses.
        timer = setTimeout(() => {
          if (cancelled) return;
          const iframe = document.querySelector('#cal-inline iframe');
          setState(iframe ? 'ready' : 'failed');
        }, 1200);
      } catch {
        if (!cancelled) setState('failed');
      }
    }

    // Hard ceiling: whatever happens, do not leave the visitor staring at a
    // spinner. Show the fallback.
    const hardTimeout = setTimeout(() => {
      if (cancelled) return;
      const iframe = document.querySelector('#cal-inline iframe');
      if (!iframe) setState('failed');
    }, timeoutMs);

    void mount();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(hardTimeout);
    };
  }, [visible, calLink, timeoutMs]);

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
            Open cal.com/{calLink} ↗
          </a>
          <a href={phoneHref} className="btn-outline px-6 py-3.5 text-[14px]">
            {phone}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-[6px] border border-rule bg-white"
    >
      <div className="flex items-center justify-between border-b border-[rgba(86,15,16,.1)] px-5 py-3.5">
        <span className="eyebrow">Free consultation — 30 min</span>
        <a href={bookingUrl} target="_blank" rel="noopener" className="text-[13px]">
          Open in a new tab ↗
        </a>
      </div>

      {state === 'loading' && (
        <p className="px-5 py-16 text-center text-[14px] text-ink-muted">
          Loading the scheduler…
        </p>
      )}

      <div
        id="cal-inline"
        style={{ minHeight: state === 'ready' ? '600px' : 0 }}
        className="w-full overflow-hidden"
      />
    </div>
  );
}
